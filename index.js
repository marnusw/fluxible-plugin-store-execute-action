/**
 * Copyright 2015, Marnus Weststrate
 * Licensed under the MIT License. See the accompanying LICENSE file for terms.
 */
'use strict';
var Promise = require('es6-promise').Promise;


/**
 * @class StoreExecuteActionPlugin
 *
 * A temporary solution to get the executeAction method on the Store Context for initiating async query actions.
 *
 * @returns {Object} The StoreExecuteActionPlugin instance.
 */
module.exports = function storeExecuteActionPlugin() {

  var serverSide = true;

  var promises = [];
  var promisesKeyed = {};
  var waiting = null;

  function deletePromises() {
    promises = [];
    waiting = null;
  }

  function waitOnPromises() {
    if (!serverSide) {
      throw new Error('The promises on the storeContext should only be used server side');
    }
    if (!waiting) {
      waiting = Promise.all(promises).then(deletePromises, deletePromises);
    }
    return waiting;
  }

  return {
    name: 'StoreExecuteActionPlugin',
    /**
     * Called to plug the FluxContext.
     * @method plugContext
     * @returns {Object}
     */
    plugContext: function() {
      return {
        /**
         * Adds the executeAction function from the actionContext to the storeContext.
         * As for components, a returned promises/done callbacks aren't supported since
         * store actions should be fire and forget.
         *
         * Promises returned from the actions are stored so other framework components
         * can detect when all queries have been completed.
         *
         * @param {Object} storeContext
         * @param {Object} context The full FluxibleContext.
         */
        plugStoreContext: function(storeContext, context) {
          storeContext.executeAction = function(action, payload) {
            var promise = context.getActionContext().executeAction(action, payload);

            if (serverSide) {
              if (waiting) {
                throw new Error('Can\'t start more queries while waiting on previous promises');
              }
              promises.push(promise);
              if (payload._queryId) {
                promisesKeyed[payload._queryId] = promise;
              }
            }
          };
        },

        /**
         * Provides a method for retrieving the the promise of all outstanding store queries.
         *
         * This should only be used in Components connecting stores to their children or other
         * very special cases, and only on the server to delay rendering; for all intents and
         * purposes in the general sense of an app `_getStoresPromise()` is a `private` method.
         *
         * @param {Object} componentContext
         */
        plugComponentContext: function(componentContext) {
          componentContext._getStoresPromise = waitOnPromises;

          componentContext.serverWaitFor = function() {
            if (!serverSide) {
              return Promise.resolve();
            }

            var promises = [];

            for (var i = 0; i < arguments.length; ++i) {
              var record = arguments[i];
              promises.push(record.get('_isLoading') ? promisesKeyed[record.get('_queryId')] : Promise.resolve());
            }

            var promiseAll = Promise.all(promises);
            promises.push(promiseAll); // So the server will wait for this promise as well.
            return promiseAll;
          }
        }
      };
    },

    /**
     * Get a promise representing all promises that were created by the queries of various
     * stores on the server.
     *
     * @returns {Array}
     */
    getStoreQueryPromise: function() {
      return waitOnPromises();
    },

    /**
     * Dummy dehydrate forces rehydration on the client.
     */
    dehydrate: function() {
      return {};
    },
    /**
     * Clear the flag to show we're now client side.
     */
    rehydrate: function() {
      serverSide = false;
    }
  };

};
