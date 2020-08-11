"use strict";

/*global require*/
var inherit = require("../Core/inherit");
var SearchProviderViewModel = require("./SearchProviderViewModel");
var SearchResultViewModel = require("./SearchResultViewModel");

var CesiumMath = require("terriajs-cesium/Source/Core/Math").default;
var defaultValue = require("terriajs-cesium/Source/Core/defaultValue").default;
var defined = require("terriajs-cesium/Source/Core/defined").default;
var Ellipsoid = require("terriajs-cesium/Source/Core/Ellipsoid").default;
var loadWithXhr = require("../Core/loadWithXhr");
var zoomRectangleFromPoint = require("../Map/zoomRectangleFromPoint");
import i18next from "i18next";

var GoogleMapsSearchProviderViewModel = function (options) {
  SearchProviderViewModel.call(this);

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  this.terria = options.terria;
  this._geocodeInProgress = undefined;

  this.name = 'Google ' + i18next.t("viewModels.searchLocations");
  this.url = defaultValue(options.url, "//dev.virtualearth.net/");
  if (this.url.length > 0 && this.url[this.url.length - 1] !== "/") {
    this.url += "/";
  }
  this.key = options.key;
  this.flightDurationSeconds = defaultValue(options.flightDurationSeconds, 1.5);

  if (!this.key) {
    console.warn(
      "The " +
      this.name +
      " geocoder will always return no results because a Google Maps key has not been provided. Please get a Google Maps key from bingmapsportal.com and add it to parameters.googleMapsKey in config.json."
    );
  }
};

inherit(SearchProviderViewModel, GoogleMapsSearchProviderViewModel);

GoogleMapsSearchProviderViewModel.prototype.search = function (searchText) {
  this.isSearching = true;
  this.searchResults.removeAll();

  if (!defined(searchText) || /^\s*$/.test(searchText)) {
    return;
  }

  this.searchMessage = undefined;
  this.terria.analytics.logEvent("search", "google", searchText);

  // If there is already a search in progress, cancel it.
  if (defined(this._geocodeInProgress)) {
    this._geocodeInProgress.cancel = true;
    this._geocodeInProgress = undefined;
  }
  var thisGeocode = loadWithXhr({
    url: this.terria.corsProxy.getURL(`https://maps.googleapis.com/maps/api/place/textsearch/json?input=${searchText}&inputtype=textquery&fields=formatted_address,name,rating,opening_hours,geometry&key=${this.key}`),
    method: "GET",
    headers: { "Content-Type": "application/json" },
    responseType: "json"
  }).then((hits) => {
    if (thisGeocode.cancel) {
      return;
    }

    this.isSearching = false;

    if (hits.results.length === 0) {
      this.searchMessage = i18next.t("viewModels.searchNoLocations");
      return;
    }
    this.searchResults = hits.results.map((hit) => {
      return new SearchResultViewModel({
        name: hit.name,
        isImportant: true,
        clickAction: createZoomToFunction(
          this.terria,
          hit.geometry.location,
          this.flightDurationSeconds
        ),
        location: {
          latitude: hit.geometry.location.lat,
          longitude: hit.geometry.location.lng,
        }
      });
    });
  }).otherwise(
    function () {
      if (thisGeocode.cancel) {
        return;
      }

      this.isSearching = false;
      this.searchMessage = i18next.t("viewModels.searchErrorOccurred");
    }.bind(this)
  );

  this._geocodeInProgress = thisGeocode;
};

function createZoomToFunction(terria, location, duration) {
  var rectangle = zoomRectangleFromPoint(
    location.lat,
    location.lng,
    0.01
  );

  return function () {
    terria.currentViewer.zoomTo(rectangle, duration);
  };
}

module.exports = GoogleMapsSearchProviderViewModel;
