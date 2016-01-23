(function () {
  'use strict';

  var events = {
    LOGGED_IN: 'LOGGED_IN',
    LOGGED_OUT: 'LOGGED_OUT',
    HTTP_401: 'HTTP_401',
    HTTP_403: 'HTTP_403',
    HTTP_404: 'HTTP_404',
    HTTP_500: 'HTTP_500'
  };

  angular
    .module('app.event')
    .factory('app.event.eventService', eventServiceFactory);

  eventServiceFactory.$inject = [
    '$rootScope'
  ];

  /**
   * @namespace app.event.eventService
   * @memberof app.event
   * @name eventService
   * @description The event bus service
   * @property {object} events - the default set of events (i.e. HTTP status codes)
   * @example
   * // subscribe to an event
   * eventService.$on(events.HTTP_401, handler);
   *
   * // emit an event
   * eventService.$emit(events.HTTP_401);
   */
  function eventServiceFactory($rootScope) {
    var eventService = $rootScope.$new();
    eventService.events = events;
    return eventService;
  }

})();
