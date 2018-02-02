import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';

import { EntityService } from '../../core/entity-service';
import { EntityServiceFactory } from '../../core/entity-service-factory.service';
import {
  ApplicationStateData,
  ApplicationStateService,
} from '../../shared/components/application-state/application-state.service';
import {
  AppMetadataTypes,
  GetAppEnvVarsAction,
  GetAppStatsAction,
  GetAppSummaryAction,
} from '../../store/actions/app-metadata.actions';
import { GetApplication, UpdateApplication, UpdateExistingApplication } from '../../store/actions/application.actions';
import { ApplicationSchema } from '../../store/actions/application.actions';
import { SpaceSchema } from '../../store/actions/space.action';
import { AppState } from '../../store/app-state';
import { ActionState } from '../../store/reducers/api-request-reducer/types';
import { selectEntity } from '../../store/selectors/api.selectors';
import { selectUpdateInfo } from '../../store/selectors/api.selectors';
import { cnsisEntitiesSelector } from '../../store/selectors/cnsis.selectors';
import { APIResource, EntityInfo } from '../../store/types/api.types';
import {
  AppEnvVarsSchema,
  AppEnvVarsState,
  AppStat,
  AppStatsSchema,
  AppSummary,
  AppSummarySchema,
} from '../../store/types/app-metadata.types';
import { PaginationEntityState } from '../../store/types/pagination.types';
import {
  getPaginationObservables,
  getPaginationPages,
  PaginationObservables,
} from './../../store/reducers/pagination-reducer/pagination-reducer.helper';
import {
  ApplicationEnvVarsService,
  EnvVarStratosProject,
} from './application/application-tabs-base/tabs/build-tab/application-env-vars.service';
import { getRoute, isTCPRoute } from './routes/routes.helper';

export interface ApplicationData {
  fetching: boolean;
  app: EntityInfo;
  stack: EntityInfo;
  cf: any;
  appUrl: string;
}

@Injectable()
export class ApplicationService {
  applicationInstanceState$: Observable<any>;

  private appEntityService: EntityService;
  private appSummaryEntityService: EntityService;

  constructor(
    public cfGuid: string,
    public appGuid: string,
    private store: Store<AppState>,
    private entityServiceFactory: EntityServiceFactory,
    private appStateService: ApplicationStateService,
    private appEnvVarsService: ApplicationEnvVarsService
  ) {
    this.appEntityService = this.entityServiceFactory.create(
      ApplicationSchema.key,
      ApplicationSchema,
      appGuid,
      new GetApplication(appGuid, cfGuid)
    );

    this.appSummaryEntityService = this.entityServiceFactory.create(
      AppSummarySchema.key,
      AppSummarySchema,
      appGuid,
      new GetAppSummaryAction(appGuid, cfGuid)
    );

    this.constructCoreObservables();
    this.constructAmalgamatedObservables();
    this.constructStatusObservables();
  }

  // NJ: This needs to be cleaned up. So much going on!
  isFetchingApp$: Observable<boolean>;
  isUpdatingApp$: Observable<boolean>;

  isDeletingApp$: Observable<boolean>;

  isFetchingEnvVars$: Observable<boolean>;
  isUpdatingEnvVars$: Observable<boolean>;
  isFetchingStats$: Observable<boolean>;

  app$: Observable<EntityInfo>;
  waitForAppEntity$: Observable<EntityInfo>;
  appSummary$: Observable<EntityInfo<AppSummary>>;
  appStats$: Observable<APIResource<AppStat>[]>;
  private appStatsFetching$: Observable<PaginationEntityState>; // Use isFetchingStats$ which is properly gated
  appEnvVars: PaginationObservables<AppEnvVarsState>;
  appOrg$: Observable<APIResource<any>>;
  appSpace$: Observable<APIResource<any>>;

  application$: Observable<ApplicationData>;
  applicationStratProject$: Observable<EnvVarStratosProject>;
  applicationState$: Observable<ApplicationStateData>;

  /**
   * Fetch the current state of the app (given it's instances) as an object ready
   *
   * @static
   * @param {Store<AppState>} store
   * @param {ApplicationStateService} appStateService
   * @param {any} app
   * @param {string} appGuid
   * @param {string} cfGuid
   * @returns {Observable<ApplicationStateData>}
   * @memberof ApplicationService
   */
  static getApplicationState(
    store: Store<AppState>,
    appStateService: ApplicationStateService,
    app,
    appGuid: string,
    cfGuid: string
  ): Observable<ApplicationStateData> {
    return getPaginationPages(
      store,
      new GetAppStatsAction(appGuid, cfGuid),
      AppStatsSchema
    ).pipe(
      map(appInstancesPages => {
        const appInstances = [].concat
          .apply([], Object.values(appInstancesPages))
          .filter(apiResource => !!apiResource)
          .map(apiResource => {
            return apiResource.entity;
          });
        return appStateService.get(app, appInstances);
      })
    );
  }

  private constructCoreObservables() {
    // First set up all the base observables
    this.app$ = this.appEntityService.entityObs$;

    // App org and space
    this.app$
      .filter(entityInfo => {
        return (
          entityInfo.entity &&
          entityInfo.entity.entity &&
          entityInfo.entity.entity.cfGuid
        );
      })
      .map(entityInfo => {
        return entityInfo.entity.entity;
      })
      .do(app => {
        this.appSpace$ = this.store.select(
          selectEntity(SpaceSchema.key, app.space_guid)
        );
        // See https://github.com/SUSE/stratos/issues/158 (Failing to populate entity store with a space's org)
        this.appOrg$ = this.store
          .select(selectEntity(SpaceSchema.key, app.space_guid))
          .map(space => space.entity.organization);
      })
      .take(1)
      .subscribe();

    this.isDeletingApp$ = this.appEntityService.isDeletingEntity$;

    this.waitForAppEntity$ = this.appEntityService.waitForEntity$;

    this.appSummary$ = this.waitForAppEntity$.mergeMap(
      () => this.appSummaryEntityService.entityObs$
    );

    this.appEnvVars = getPaginationObservables<AppEnvVarsState>(
      {
        store: this.store,
        action: new GetAppEnvVarsAction(this.appGuid, this.cfGuid),
        schema: AppEnvVarsSchema
      },
      true
    );
  }

  private constructAmalgamatedObservables() {
    // Assign/Amalgamate them to public properties (with mangling if required)

    const appStats = getPaginationObservables<APIResource<AppStat>>(
      {
        store: this.store,
        action: new GetAppStatsAction(this.appGuid, this.cfGuid),
        schema: AppStatsSchema
      },
      true
    );

    this.appStats$ = this.waitForAppEntity$
      .filter(ai => ai && ai.entity && ai.entity.entity)
      .mergeMap(ai => {
        if (ai.entity.entity.state === 'STARTED') {
          return appStats.entities$;
        } else {
          return Observable.of(new Array<APIResource<AppStat>>());
        }
      });

    this.appStatsFetching$ = this.waitForAppEntity$
      .filter(
        ai =>
          ai &&
          ai.entity &&
          ai.entity.entity &&
          ai.entity.entity.state === 'STARTED'
      )
      .mergeMap(ai => {
        return appStats.pagination$;
      });

    this.application$ = this.waitForAppEntity$
      .combineLatest(this.store.select(cnsisEntitiesSelector))
      .filter(([{ entity, entityRequestInfo }, cnsis]: [EntityInfo, any]) => {
        return entity && entity.entity && entity.entity.cfGuid;
      })
      .map(
        ([{ entity, entityRequestInfo }, cnsis]: [
          EntityInfo,
          any
        ]): ApplicationData => {
          return {
            fetching: entityRequestInfo.fetching,
            app: entity,
            stack: entity.entity.stack,
            cf: cnsis[entity.entity.cfGuid],
            appUrl: this.getAppUrl(entity)
          };
        }
      );

    this.applicationState$ = this.waitForAppEntity$
      .combineLatest(this.appStats$)
      .map(([appInfo, appStatsArray]: [EntityInfo, APIResource<AppStat>[]]) => {
        return this.appStateService.get(
          appInfo.entity.entity,
          appStatsArray.map(apiResource => apiResource.entity)
        );
      });

    this.applicationInstanceState$ = this.waitForAppEntity$
      .combineLatest(this.appStats$)
      .mergeMap(
        ([appInfo, appStatsArray]: [EntityInfo, APIResource<AppStat>[]]) => {
          return ApplicationService.getApplicationState(
            this.store,
            this.appStateService,
            appInfo.entity.entity,
            this.appGuid,
            this.cfGuid
          );
        }
      );

    this.applicationStratProject$ = this.appEnvVars.entities$.map(
      applicationEnvVars => {
        return this.appEnvVarsService.FetchStratosProject(
          applicationEnvVars[0]
        );
      }
    );
  }

  private constructStatusObservables() {
    /**
     * An observable based on the core application entity
     */
    this.isFetchingApp$ = Observable.combineLatest(
      this.app$.map(ei => ei.entityRequestInfo.fetching),
      this.appSummary$.map(as => as.entityRequestInfo.fetching)
    ).map(fetching => fetching[0] || fetching[1]);

    this.isUpdatingApp$ = this.app$.map(a => {
      const updatingSection = a.entityRequestInfo.updating[
        UpdateExistingApplication.updateKey
      ] || {
        busy: false
      };
      return updatingSection.busy || false;
    });

    this.isFetchingEnvVars$ = this.appEnvVars.pagination$
      .map(ev => ev.fetching)
      .startWith(false);

    this.isUpdatingEnvVars$ = this.appEnvVars.pagination$
      .map(ev => ev.fetching && ev.ids[ev.currentPage])
      .startWith(false);

    this.isFetchingStats$ = this.appStatsFetching$
      .map(appStats => (appStats ? appStats.fetching : false))
      .startWith(false);
  }

  getAppUrl(app: EntityInfo): string {
    if (!app.entity.routes) {
      return null;
    }
    const nonTCPRoutes = app.entity.routes.filter(p => !isTCPRoute(p));
    if (nonTCPRoutes.length > 0) {
      return getRoute(
        nonTCPRoutes[0],
        true,
        false,
        nonTCPRoutes[0].entity.domain
      );
    }
    return null;
  }

  isEntityComplete(value, requestInfo: { fetching: boolean }): boolean {
    if (requestInfo) {
      return !requestInfo.fetching;
    } else {
      return !!value;
    }
  }

  /*
  * Update an application
  */
  updateApplication(
    updatedApplication: UpdateApplication,
    updateEntities?: AppMetadataTypes[]
  ): Observable<ActionState> {
    this.store.dispatch(
      new UpdateExistingApplication(
        this.appGuid,
        this.cfGuid,
        { ...updatedApplication },
        updateEntities
      )
    );

    // Create an Observable that can be used to determine when the update completed
    const actionState = selectUpdateInfo(
      ApplicationSchema.key,
      this.appGuid,
      UpdateExistingApplication.updateKey
    );
    return this.store.select(actionState).filter(item => !item.busy);
  }
}
