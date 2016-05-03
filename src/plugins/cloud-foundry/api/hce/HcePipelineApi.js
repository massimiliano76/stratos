/* DO NOT EDIT: This code has been generated by swagger-codegen */
(function () {
  'use strict';

  angular
    .module('cloud-foundry.api')
    .run(registerApi);

  registerApi.$inject = [
    '$http',
    'app.api.apiManager'
  ];

  function registerApi($http, apiManager) {
    apiManager.register('cloud-foundry.api.HcePipelineApi', new HcePipelineApi($http));
  }

  /**
    * @constructor
    * @name HcePipelineApi
    * @description For more information on this API, please see:
    * https://github.com/hpcloud/hce-rest-service/blob/master/app/v2/swagger.yml
    * @param {object} $http - the Angular $http service
    * @property {object} $http - the Angular $http service
    * @property {string} baseUrl - the API base URL
    * @property {object} defaultHeaders - the default headers
    */
  function HcePipelineApi($http) {
    this.$http = $http;
    this.baseUrl = '/api/ce/v2';
    this.defaultHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    };
  }

  angular.extend(HcePipelineApi.prototype, {
    /**
     * @name deletePipelineExecution
     * @description Delete the specified build.
     * @param {!number} executionId - Build id.
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    deletePipelineExecution: function (executionId, params) {
      var path = this.baseUrl + '/pipelines/executions/{execution_id}'
        .replace('{' + 'execution_id' + '}', executionId);

      var config = {
        method: 'DELETE',
        url: path,
        params: params || {},
        headers: this.defaultHeaders
      };

      return this.$http(config);
    },

    /**
     * @name getPipelineEvent
     * @description Get the specified pipeline event.
     * @param {!number} eventId - PipelineEvent id.
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    getPipelineEvent: function (eventId, params) {
      var path = this.baseUrl + '/pipelines/events/{event_id}'
        .replace('{' + 'event_id' + '}', eventId);

      var config = {
        method: 'GET',
        url: path,
        params: params || {},
        headers: this.defaultHeaders
      };

      return this.$http(config);
    },

    /**
     * @name getPipelineEvents
     * @description List pipeline events, optionally filtering by Build id.
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    getPipelineEvents: function (params) {
      var path = this.baseUrl + '/pipelines/events';

      var config = {
        method: 'GET',
        url: path,
        params: params || {},
        headers: this.defaultHeaders
      };

      return this.$http(config);
    },

    /**
     * @name getPipelineExecution
     * @description Gets the specified build.
     * @param {!number} executionId - Build id.
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    getPipelineExecution: function (executionId, params) {
      var path = this.baseUrl + '/pipelines/executions/{execution_id}'
        .replace('{' + 'execution_id' + '}', executionId);

      var config = {
        method: 'GET',
        url: path,
        params: params || {},
        headers: this.defaultHeaders
      };

      return this.$http(config);
    },

    /**
     * @name getPipelineExecutions
     * @description List executions, optionally filtering by project_id.
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    getPipelineExecutions: function (params) {
      var path = this.baseUrl + '/pipelines/executions';

      var config = {
        method: 'GET',
        url: path,
        params: params || {},
        headers: this.defaultHeaders
      };

      return this.$http(config);
    },

    /**
     * @name pipelineEventOccurred
     * @description Record a PipelineEvent.
     * @param {object} data - the request body
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    pipelineEventOccurred: function (data, params) {
      var path = this.baseUrl + '/pipelines/events';

      var config = {
        method: 'POST',
        url: path,
        params: params || {},
        data: data,
        headers: this.defaultHeaders
      };

      return this.$http(config);
    },

    /**
     * @name triggerPipelineExecution
     * @description Trigger execution of a pipeline(s).
     * @param {object} data - the request body
     * @param {object} params - the query parameters
     * @returns {promise} A resolved/rejected promise
     */
    triggerPipelineExecution: function (data, params) {
      var path = this.baseUrl + '/pipelines/triggers';

      var config = {
        method: 'POST',
        url: path,
        params: params || {},
        data: data,
        headers: this.defaultHeaders
      };

      return this.$http(config);
    }
  });
})();
