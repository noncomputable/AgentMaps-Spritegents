let centroid = require('@turf/centroid').default;

/**
 * The main class representing individual spritegents, using Leaflet class system.
 * @private
 *
 * @class Spritegent
 */
var Spritegent = {};

/**
 * Constructor for the Spritegent class, using Leaflet class system.
 * 
 * @name Spritegent
 * @constructor 
 * @param {LatLng} lat_lng - A pair of coordinates to place the spritegent at.
 * @param {Object} icon_options - An array of options for the Leaflet Icon depicting the Spritegent.
 * @param {Object} marker_options - An array of options for the Leaflet Marker representing the Spritegent.
 * @param {Agentmap} agentmap - The agentmap instance in which the spritegent exists.
 * @property {Agentmap} agentmap - The agentmap instance in which the spritegent exists.
 * @property {Place} place - A place object specifying where the spritegent is currently at.
 * @property {number} [steps_made=0] - The number of steps the spritegent has moved since the beginning.
 * @property {Object} this.trip - Properties detailing information about the spritegent's trip that change sometimes, but needs to be accessed by future updates.
 * @property {boolean} this.trip.moving - Whether the spritegent currently moving.
 * @property {boolean} this.trip.paused - Whether the spritegent should be allowed to move along its trip.
 * @property {?Point} this.trip.current_point - The point where the spritegent is currently located.
 * @property {?Point} this.trip.goal_point - The point where the spritegent is traveling to.
 * @property {?number} this.trip.lat_dir - The latitudinal direction. -1 if traveling to lower latitude (down), 1 if traveling to higher latitude (up).
 * @property {?number} this.trip.lng_dir - The longitudinal direction. -1 if traveling to lesser longitude (left), 1 if traveling to greater longitude (right).
 * @property {?number} this.trip.speed - The speed that the spritegent should travel, in meters per tick.
 * @property {?number} this.trip.angle - The angle between the current point and the goal.
 * @property {?number} this.trip.slope - The slope of the line segment formed by the two points between which the spritegent is traveling at this time during its trip.
 * @property {Array} this.trip.path - A sequence of LatLngs; the spritegent will move from one to the next, popping each one off after it arrives until the end of the street; or, until the trip is changed/reset.
 * @property {?function} controller - User-defined function to be called on each update (each tick).
 * @property {?function} fine_controller - User-defined function to be called before & after each movemnt (on each step an spritegent performs during a tick).
 */
Spritegent.initialize = function(lat_lng, icon_options, marker_options, agentmap) {
	this.agentmap = agentmap,
	this.place = null,
	this.steps_made = 0,
	this.trip = {
		paused: false,
		moving: false,
		current_point: null,
		goal_point: null,
		lat_dir: null,
		lng_dir: null,
		slope: null,
		angle: null,
		speed: null,
		path: [],
	},
	this.controller = function() {},
	this.fine_controller = function() {};
	
	if (marker_options) {
		marker_options.icon = L.icon(icon_options);
	}
}

//Copy over the agents' movement methods.
Spritegent.resetTrip = L.A.Agent.prototype.resetTrip,
Spritegent.startTrip = L.A.Agent.prototype.startTrip,
Spritegent.pauseTrip = L.A.Agent.prototype.pauseTrip,
Spritegent.resumeTrip = L.A.Agent.prototype.resumeTrip,
Spritegent.travelTo = L.A.Agent.prototype.travelTo,
Spritegent.newTripStartPlace = L.A.Agent.prototype.newTripStartPlace,
Spritegent.setTravelInUnit = L.A.Agent.prototype.setTravelInUnit,
Spritegent.setTravelToPlace = L.A.Agent.prototype.setTravelToPlace,
Spritegent.scheduleTrip = L.A.Agent.prototype.scheduleTrip,
Spritegent.setTravelAlongStreet = L.A.Agent.prototype.setTravelAlongStreet,
Spritegent.setTravelOnSameStreet = L.A.Agent.prototype.setTravelOnSameStreet,
Spritegent.setTravelOnStreetNetwork = L.A.Agent.prototype.setTravelOnStreetNetwork,
Spritegent.setSpeed = L.A.Agent.prototype.setSpeed,
Spritegent.multiplySpeed = L.A.Agent.prototype.multiplySpeed,
Spritegent.increaseSpeed = L.A.Agent.prototype.increaseSpeed,
Spritegent.checkSpeed = L.A.Agent.prototype.checkSpeed,
Spritegent.travel = L.A.Agent.prototype.travel,
Spritegent.step = L.A.Agent.prototype.step,
Spritegent.checkArrival = L.A.Agent.prototype.checkArrival,
Spritegent.moveIt = L.A.Agent.prototype.moveIt;

Spritegent = L.Marker.extend(Spritegent);

/**
 * Returns a Spritegent object.
 *
 * @param {LatLng} lat_lng - A pair of coordinates to place the spritegent at.
 * @param {Object} icon_options - An array of options for the Leaflet Icon depicting the Spritegent.
 * @param {Object} marker_options - An array of options for the Leaflet Marker representing the Spritegent.
 * @param {Agentmap} agentmap - The agentmap instance in which the spritegent exists.
 */
function spritegent(lat_lng, icon_options, marker_options, agentmap) {
	return new Spritegent(lat_lng, icon_options, marker_options, agentmap);
}

//Add Spritegent to the AgentMaps namespace.
L.A.Spritegent = Spritegent;

/**
 * A user-defined callback function that returns a feature with appropriate geometry and properties to represent a spritegent.
 *
 * @callback spritegentFeatureMaker
 * @param {number} id - The agent's Leaflet layer ID.
 * @returns {Point} - A GeoJSON Point object with geometry and other properties for the spritegent, including
 * a "place" property that will set the spritegent's initial {@link Place}, an "icon_options" property
 * that will specify the icon's Leaflet options (like its source and size), and a "marker_options" property
 * that will specify the marker's Leaflet options (like its opacity). All other provided properties 
 * will be transferred to the Spritegent object once it is created.
 * See {@link https://leafletjs.com/reference-1.3.2.html#marker} and {@link https://leafletjs.com/reference-1.3.2.html#marker} 
 * for all possible Icon and Marker options.
 *
 * @example
 * let point = {					
 * 	"type": "Feature",				 
 * 	"properties": {					
 * 		"icon_options": {			
 * 			"iconUrl": "pic.jpg",			
 * 			"iconSize": [38, 95],
 * 			"iconAnchor": [22, 94]
 * 		},
 * 		"marker_options": {
 * 			"riseOnHover": true	
 * 		}
 * 		"place": {				
 * 			"type": "unit",			
 * 			"id": 89			
 * 		},					
 * 							
 * 		age: 72,				
 * 		home_city: "LA"				
 * 	},						
 * 	"geometry" {					
 * 		"type": "Point",			
 * 		"coordinates": [			
 * 			14.54589,			
 * 			57.136239			
 * 		]					
 * 	}						
 * }							
 */

/**
 * A standard {@link spritegentFeatureMaker}, which sets a spritegent's location to be the point near the center of the i�� unit of the map,
 * its place property to be that unit's, and its layer_options to be red and of radius .5 meters.
 * @memberof Agentmap
 * @instance
 * @type {spritegentFeatureMaker}
 */
function seqUnitSpritegentMaker(id){
	let index = this.agents.count();

	if (index > this.units.getLayers().length - 1) {
		throw new Error("seqUnitSpritegentMaker cannot accommodate more agents than there are units.");
	}
	
	let unit = this.units.getLayers()[index],
	unit_id = this.units.getLayerId(unit),
	center_point = centroid(unit.feature);
	center_point.properties.place = {"type": "unit", "id": unit_id},
	center_point.properties.icon_options = {
		"iconUrl": "https://leafletjs.com/examples/custom-icons/leaf-orange.png",
		"iconSize": [38, 95],
		"iconAnchor": [22, 94]
	},
	center_point.properties.marker_options = {};
	
	return center_point;
}

/**
 * Generate some number of Spritegents and place them on the map.
 * @memberof Agentmap
 * @instance
 *
 * @param {number} count - The desired number of spritegents.
 * @param {spritegentFeatureMaker} spritegentFeatureMaker - A callback that determines an spritegent i's feature properties and geometry (always a Point).
 */
function Spritegentify(count, spritegentFeatureMaker) {
	let agentmap = this;

	if (!(this.agents instanceof L.LayerGroup)) {
		this.agents = L.featureGroup().addTo(this.map);
	}

	let agents_existing = agentmap.agents.getLayers().length;
	for (let i = agents_existing; i < agents_existing + count; i++) {
		let new_spritegent = spritegent(null, null, null, agentmap);
		
		//Callback function aren't automatically bound to the agentmap.
		let boundFeatureMaker = spritegentFeatureMaker.bind(agentmap),
		spritegent_feature = boundFeatureMaker(new_spritegent._leaflet_id);
		
		let coordinates = L.A.reversedCoordinates(spritegent_feature.geometry.coordinates),
		place = spritegent_feature.properties.place,
		icon_options = spritegent_feature.properties.icon_options,
		marker_options = spritegent_feature.properties.marker_options;
		
		//Make sure the agent feature is valid and has everything we need.
		if (!L.A.isPointCoordinates(coordinates)) {
			throw new Error("Invalid feature returned from spritegentFeatureMaker: geometry.coordinates must be a 2-element array of numbers.");	
		}
		else if (typeof(place.id) !== "number") {
			throw new Error("Invalid feature returned from spritegentFeatureMaker: properties.place must be a {unit: unit_id} or {street: street_id} with an existing layer's ID.");	
		}

		let icon = L.icon(icon_options);
//markers dont have setStyle options like circleMarkers
		new_spritegent.setLatLng(coordinates);
		new_spritegent.setIcon(icon);
		new_spritegent.place = place;
		
		delete spritegent_feature.properties.layer_options;
		Object.assign(new_spritegent, spritegent_feature.properties);
		
		this.agents.addLayer(new_spritegent);
	}
}

exports.spritegent = spritegent,
exports.spritegentify = Spritegentify,
exports.seqUnitSpritegentMaker = seqUnitSpritegentMaker;