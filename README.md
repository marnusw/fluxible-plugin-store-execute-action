fluxible-plugin-store-execute-action
==========================

A temporary solution to get the `executeAction()` method on the Store Context for initiating async query actions.

```
npm install fluxible-plugin-store-execute-action 
```

# Limitations

I'm assuming all executed actions return a `Promise` since that was my use case. If you are using
callbacks, submit a PR with the necessary changes to support both and I'll merge it.

# Usage

Since plugins don't have access to the Fluxible Context internally and cross-context access is needed
to call `actionContext.executeAction()` from `storeContext.executeAction()`, the context must be set
on the plugin during the application bootstrap.

Thereafter, stores can execute actions via their context. As for components store actions should be
fire and forget, and, therefore, a promises is not returned nor a done callback supported. Success
or failure of the asynchronous operation should be handled by dispatching appropriate actions.

See the code examples below.

### Application Bootstrap

```javascript

// common.js

import StoreExecuteActionPlugin from 'fluxible-plugin-storeExecuteAction';
app.plug(StoreExecuteActionPlugin());

// server.js

var context = app.createContext({});

// Once the plugin has a context stores can execute actions.
app.getPlugin('StoreExecuteActionPlugin').giveContextAccess(context);

// When using React-Router for example:
router.run((Root, routerState) => {
  var componentContext = context.getComponentContext();

  // Components retrieve data from stores in a static `routeQuery` method. Since the stores don't
  // have cached data they execute async actions to retrieve it.
  routerState.routes
    .filter(route => route.handler.routeQuery)
    .forEach(route => route.handler.routeQuery(routerState.params, componentContext));

  // Retrieve the promise of all outstanding async actions and render once it resolves.
  app.getPlugin('StoreExecuteActionPlugin').getStoreQueryPromise()
    .then(() => {
      // All necessary data has now been read into stores
      // Proceed to render Root as usual...      
    })
    .catch(err => console.log(err));
})

// client.js

app.rehydrate(dehydratedState, function(err, context) {

  app.getPlugin('StoreExecuteActionPlugin').giveContextAccess(context);

  // Client rendering as usual...
});

```

### Use within Stores

```

// findAction.js

function findAction(actionContext, payload) {

  return actionContext.queryUtils.find(payload)
    .then(records => {
      actionContext.dispatch('RECEIVE_RECORDS', records);
      return records;
    });
}

// SomeStore.js

class SomeStore extends BaseStore {

  getRecord(id) {
    if (this.records[id]) {
      // Return the record if it exists.
      return this.records[id];
    }
    
    // Or execute a query action...
    this.getContext().executeAction(findAction, {/*Query payload*/});
    
    // Potentially set a 'loading' flag here.
  }
  
  handleReceiveRecords(payload) {
    payload.records.forEach(recordData => this.records[recordData.id] = recordData, this);
    // Clear 'loading' flags.
    this.emitChange();
  }
}

SomeStore.handlers = {
  'RECEIVE_RECORDS': 'handleReceiveRecords'
};

```

# License

MIT
