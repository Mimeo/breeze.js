﻿(function (factory) {
  if (breeze) {
    factory(breeze);
  } else if (typeof require === "function" && typeof exports === "object" && typeof module === "object") {
    // CommonJS or Node: hard-coded dependency on "breeze"
    factory(require("breeze"));
  } else if (typeof define === "function" && define["amd"] && !breeze) {
    // AMD anonymous module with hard-coded dependency on "breeze"
    define(["breeze"], factory);
  }
}(function (breeze) {
  "use strict";

  var MetadataStore = breeze.MetadataStore;
  var JsonResultsAdapter = breeze.JsonResultsAdapter;
  var AbstractDataServiceAdapter = breeze.AbstractDataServiceAdapter;

  var ctor = function DataServiceWebApiAdapter() {
    this.name = "webApi";
  };
  var proto = ctor.prototype = new AbstractDataServiceAdapter();

  proto._prepareSaveBundle = function (saveContext, saveBundle) {
    var changeRequestInterceptor = this._createChangeRequestInterceptor(saveContext, saveBundle);
    var em = saveContext.entityManager;
    var metadataStore = em.metadataStore;
    var helper = em.helper;

    saveBundle.entities = saveBundle.entities.map(function (e, ix) {
      var rawEntity = helper.unwrapInstance(e);

      var autoGeneratedKey = null;
      if (e.entityType.autoGeneratedKeyType !== AutoGeneratedKeyType.None) {
        autoGeneratedKey = {
          propertyName: e.entityType.keyProperties[0].nameOnServer,
          autoGeneratedKeyType: e.entityType.autoGeneratedKeyType.name
        };
      }

      var originalValuesOnServer = helper.unwrapOriginalValues(e, metadataStore);
      rawEntity.entityAspect = {
        entityTypeName: e.entityType.name,
        defaultResourceName: e.entityType.defaultResourceName,
        entityState: e.entityAspect.entityState.name,
        originalValuesMap: originalValuesOnServer,
        autoGeneratedKey: autoGeneratedKey
      };
      rawEntity = changeRequestInterceptor.getRequest(rawEntity, e, ix);
      return rawEntity;
    });

    saveBundle.saveOptions = { tag: saveBundle.saveOptions.tag };
    changeRequestInterceptor.done(saveBundle.entities);
    return saveBundle;
  };

  proto._prepareSaveResult = function (saveContext, data) {
    // if lower case then all properties are already in there 'correct' case
    // and the entityType name is already a client side name.
    if (data.entities) {
      // data: { entities: array of entities, keyMappings array of keyMappings
      //   where: keyMapping: { entityTypeName: ..., tempValue: ..., realValue ... }
      return data;
    } else {
      // else if coming from .NET
      // HACK: need to change the 'case' of properties in the saveResult
      // but KeyMapping properties internally are still ucase. ugh...
      var keyMappings = data.KeyMappings.map(function (km) {
        var entityTypeName = MetadataStore.normalizeTypeName(km.EntityTypeName);
        return { entityTypeName: entityTypeName, tempValue: km.TempValue, realValue: km.RealValue };
      });
      return { entities: data.Entities, keyMappings: keyMappings };
    }
  };

  proto.jsonResultsAdapter = new JsonResultsAdapter({

    name: "webApi_default",

    visitNode: function (node, mappingContext, nodeContext) {
      if (node == null) return {};
      var entityTypeName = MetadataStore.normalizeTypeName(node.$type);
      var entityType = entityTypeName && mappingContext.entityManager.metadataStore._getEntityType(entityTypeName, true);
      var propertyName = nodeContext.propertyName;
      var ignore = propertyName && propertyName.substr(0, 1) === "$";

      return {
        entityType: entityType,
        nodeId: node.$id,
        nodeRefId: node.$ref,
        ignore: ignore
      };
    }

  });


  breeze.config.registerAdapter("dataService", ctor);

}));