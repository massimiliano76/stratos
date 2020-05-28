import { Inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, of } from 'rxjs';
import { distinctUntilChanged, map, switchMap } from 'rxjs/operators';

import { InternalAppState } from '../../../../store/src/app-state';
import { entityCatalog } from '../../../../store/src/entity-catalog/entity-catalog';
import { selectEntity } from '../../../../store/src/selectors/api.selectors';
import { EndpointModel } from '../../../../store/src/types/endpoint.types';
import { ENDPOINT_TYPE, STRATOS_ENDPOINT_TYPE } from '../../base-entity-schemas';
import { LoggerService } from '../logger.service';
import {
  CurrentUserPermissions,
  PermissionConfig,
  PermissionConfigLink,
  PermissionConfigType,
  PermissionTypes,
} from './current-user-permissions.config';
import {
  BaseCurrentUserPermissionsChecker,
  IConfigGroup,
  IConfigGroups,
  ICurrentUserPermissionsChecker,
  IPermissionCheckCombiner,
  StratosUserPermissionsChecker,
} from './stratos-user-permissions.checker';


export const CUSTOM_USER_PERMISSION_CHECKERS = 'custom_user_perm_checkers'

@Injectable()
export class CurrentUserPermissionsService {
  private allCheckers: ICurrentUserPermissionsChecker[];
  constructor(
    private store: Store<InternalAppState>,
    @Inject(CUSTOM_USER_PERMISSION_CHECKERS) customCheckers: ICurrentUserPermissionsChecker[],
    private logger: LoggerService
  ) {
    this.allCheckers = [
      new StratosUserPermissionsChecker(store),
      ...customCheckers
    ]
  }
  /**
   * @param action The action we're going to check the user's access to.
   * @param endpointGuid If endpointGuid is provided without a  orgOrSpaceGuid the checks will be done across all orgs and
   * spaces within the cf.
   * If no endpoint guid is provided we will do the check over all of the endpoint and all orgs/spaces.
   * @param orgOrSpaceGuid If this is the only param then it will be used as the id to for all permission checks.
   * @param spaceGuid If this is provided then the orgOrSpaceGuid will be used for org related permission checks and this will be
   *  used for space related permission checks.
   */
  public can(
    action: CurrentUserPermissions | PermissionConfigType,
    endpointGuid?: string,
    ...args: any[]
  ): Observable<boolean> {
    let actionConfig;
    if (typeof action === 'string') {
      let permConfigType = this.getPermissionConfig(action);
      if (!permConfigType) {
        return of(false); // Logging handled in getPermissionConfig
      }
      actionConfig = this.getConfig(permConfigType);
    } else {
      actionConfig = this.getConfig(action)
    }
    const obs$ = this.getCanObservable(actionConfig, endpointGuid, ...args);
    return obs$ ?
      obs$.pipe(distinctUntilChanged()) :
      of(false);
  }

  private getCanObservable(
    actionConfig: PermissionConfig[] | PermissionConfig,
    endpointGuid: string,
    ...args: any[]): Observable<boolean> {
    if (Array.isArray(actionConfig)) {
      return this.getComplexPermission(actionConfig, endpointGuid, ...args);
    } else if (actionConfig) {
      return this.getSimplePermission(actionConfig, endpointGuid, ...args);
    } else if (endpointGuid) {
      const key = entityCatalog.getEntityKey(STRATOS_ENDPOINT_TYPE, ENDPOINT_TYPE);
      return this.store.select(selectEntity<EndpointModel>(key, endpointGuid)).pipe(
        switchMap(endpoint => endpoint ?
          this.getFallbackPermission(endpointGuid, endpoint.cnsi_type) :
          of(false)
        )
      );
    }
    return null;
  }

  private getSimplePermission(actionConfig: PermissionConfig, endpointGuid: string, ...args: any[]): Observable<boolean> {
    return this.findChecker<Observable<boolean>>(
      (checker: ICurrentUserPermissionsChecker) => checker.getSimpleCheck(actionConfig, endpointGuid, ...args),
      'permissions check',
      actionConfig.type,
      of(false)
    )
  }

  private getComplexPermission(actionConfigs: PermissionConfig[], endpointGuid?: string, ...args: any[]) {
    const groupedChecks = this.groupConfigs(actionConfigs);
    const checks = this.getChecksFromConfigGroups(groupedChecks, endpointGuid, ...args);
    return this.combineChecks(checks);
  }

  private groupConfigs(configs: PermissionConfig[]): IConfigGroups {
    return configs.reduce((grouped, config) => {
      const type = config.type;
      return {
        ...grouped,
        [type]: [
          ...(grouped[type] || []),
          config
        ]
      };
    }, {});
  }

  private getChecksFromConfigGroups(groups: IConfigGroups, endpointGuid?: string, ...args: any[]) {
    return Object.keys(groups).map((permission: PermissionTypes) => {
      return this.getCheckFromConfig(groups[permission], permission, endpointGuid, ...args);
    });
  }

  private getCheckFromConfig(
    configGroup: IConfigGroup,
    permission: PermissionTypes,
    endpointGuid: string,
    ...args: any[]
  ): IPermissionCheckCombiner {
    return this.findChecker<IPermissionCheckCombiner>(
      (checker: ICurrentUserPermissionsChecker) => checker.getComplexCheck(configGroup, permission, endpointGuid, ...args),
      'permissions check',
      permission,
      {
        checks: [of(false)]
      }
    )
  }

  private getConfig(config: PermissionConfigType, tries = 0): PermissionConfig[] | PermissionConfig {
    const linkConfig = config as PermissionConfigLink;
    if (linkConfig.link) {
      if (tries >= 20) {
        // Tried too many times to get permission config, circular reference very likely.
        return;
      }
      ++tries;
      return this.getLinkedPermissionConfig(linkConfig, tries);
    } else {
      return config as PermissionConfig[] | PermissionConfig;
    }
  }

  private getLinkedPermissionConfig(linkConfig: PermissionConfigLink, tries = 0) {
    return this.getConfig(this.getPermissionConfig(linkConfig.link), tries);
  }

  private combineChecks(
    checkCombiners: IPermissionCheckCombiner[],
  ) {
    const reducedChecks = checkCombiners.map(combiner => BaseCurrentUserPermissionsChecker.reduceChecks(combiner.checks, combiner.combineType));
    return combineLatest(reducedChecks).pipe(
      map(checks => checks.every(check => check))
    );
  }

  private getFallbackPermission(endpointGuid: string, endpointType: string): Observable<boolean> {
    return this.findChecker<Observable<boolean>>(
      (checker: ICurrentUserPermissionsChecker) => checker.getFallbackCheck(endpointGuid, endpointType),
      'fallback permission',
      'N/A',
      of(null)
    )
  }

  private getPermissionConfig(key: CurrentUserPermissions): PermissionConfigType {
    return this.findChecker<PermissionConfigType>(
      (checker: ICurrentUserPermissionsChecker) => checker.getPermissionConfig(key),
      'permissions checker',
      key,
      null
    )
  }

  /**
   * Search through all known checkers for a single result
   * If none are found log warning (hints at bug/misconfigure).
   * If more than one is found log warning (hints re bug/misconfigure/devious plugin)
   */
  private findChecker<T>(
    checkFn: (checker: ICurrentUserPermissionsChecker) => T,
    checkNoun: string,
    checkType: string,
    failureValue: T
  ): T {
    const res: T[] = [];
    for (let i = 0; i < this.allCheckers.length; i++) {
      const checkerRes = checkFn(this.allCheckers[i]);
      if (checkerRes) {
        res.push(checkerRes);
      }
    }
    if (res.length == 0) {
      this.logger.warn(`Permissions: Failed to find a '${checkNoun}' for '${checkType}'. Permission Denied.`);
      return failureValue;
    }
    if (res.length === 1) {
      return res[0];
    }
    if (res.length > 1) {
      this.logger.warn(`Permissions: Found too many '${checkNoun}' for '${checkType}'. Permission Denied.`);
      return failureValue;
    }
  }
}
