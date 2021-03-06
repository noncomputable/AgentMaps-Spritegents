let centroid = require('@turf/centroid').default;

/**
 * The main class representing individual iconagents, using Leaflet class system.
 * @private
 *
 * @class IconAgent
 */
var IconAgent = {};

/**
 * Constructor for the IconAgent class, using Leaflet class system.
 * 
 * @name IconAgent
 * @constructor 
 * @param {LatLng} lat_lng - A pair of coordinates to place the iconagent at.
 * @param {Object} icon - A Leaflet Icon instance that will depict the IconAgent.
 * @param {Agentmap} agentmap - The agentmap instance in which the iconagent exists.
 * @property {Agentmap} agentmap - The agentmap instance in which the iconagent exists.
 * @property {Place} place - A place object specifying where the iconagent is currently at.
 * @property {number} [steps_made=0] - The number of steps the iconagent has moved since the beginning.
 * @property {Object} this.trip - Properties detailing information about the iconagent's trip that change sometimes, but needs to be accessed by future updates.
 * @property {boolean} this.trip.moving - Whether the iconagent currently moving.
 * @property {boolean} this.trip.paused - Whether the iconagent should be allowed to move along its trip.
 * @property {?Point} this.trip.current_point - The point where the iconagent is currently located.
 * @property {?Point} this.trip.goal_point - The point where the iconagent is traveling to.
 * @property {?number} this.trip.lat_dir - The latitudinal direction. -1 if traveling to lower latitude (down), 1 if traveling to higher latitude (up).
 * @property {?number} this.trip.lng_dir - The longitudinal direction. -1 if traveling to lesser longitude (left), 1 if traveling to greater longitude (right).
 * @property {?number} this.trip.speed - The speed that the iconagent should travel, in meters per tick.
 * @property {?number} this.trip.angle - The angle between the current point and the goal.
 * @property {?number} this.trip.slope - The slope of the line segment formed by the two points between which the iconagent is traveling at this time during its trip.
 * @property {Array} this.trip.path - A sequence of LatLngs; the iconagent will move from one to the next, popping each one off after it arrives until the end of the street; or, until the trip is changed/reset.
 * @property {?function} controller - User-defined function to be called on each update (each tick).
 * @property {?function} fine_controller - User-defined function to be called before & after each movemnt (on each step an iconagent performs during a tick).
 */
IconAgent.initialize = function(lat_lng, icon, agentmap) {
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

	L.Marker.prototype.initialize.call(this, lat_lng, {"icon": icon});
}

//Copy over the agents' movement methods.
IconAgent.resetTrip = L.A.Agent.prototype.resetTrip,
IconAgent.startTrip = L.A.Agent.prototype.startTrip,
IconAgent.pauseTrip = L.A.Agent.prototype.pauseTrip,
IconAgent.resumeTrip = L.A.Agent.prototype.resumeTrip,
IconAgent.travelTo = L.A.Agent.prototype.travelTo,
IconAgent.newTripStartPlace = L.A.Agent.prototype.newTripStartPlace,
IconAgent.setTravelInUnit = L.A.Agent.prototype.setTravelInUnit,
IconAgent.setTravelToPlace = L.A.Agent.prototype.setTravelToPlace,
IconAgent.scheduleTrip = L.A.Agent.prototype.scheduleTrip,
IconAgent.setTravelAlongStreet = L.A.Agent.prototype.setTravelAlongStreet,
IconAgent.setTravelOnSameStreet = L.A.Agent.prototype.setTravelOnSameStreet,
IconAgent.setTravelOnStreetNetwork = L.A.Agent.prototype.setTravelOnStreetNetwork,
IconAgent.setSpeed = L.A.Agent.prototype.setSpeed,
IconAgent.multiplySpeed = L.A.Agent.prototype.multiplySpeed,
IconAgent.increaseSpeed = L.A.Agent.prototype.increaseSpeed,
IconAgent.checkSpeed = L.A.Agent.prototype.checkSpeed,
IconAgent.travel = L.A.Agent.prototype.travel,
IconAgent.step = L.A.Agent.prototype.step,
IconAgent.checkArrival = L.A.Agent.prototype.checkArrival,
IconAgent.moveIt = L.A.Agent.prototype.moveIt;

IconAgent = L.Marker.extend(IconAgent);

/**
 * Returns a IconAgent object.
 *
 * @param {LatLng} lat_lng - A pair of coordinates to place the iconagent at.
 * @param {Object} icon - A Leaflet Icon to depict the agent with.
 * @param {Agentmap} agentmap - The agentmap instance in which the iconagent exists.
 */
function iconagent(lat_lng, icon, agentmap) {
	return new IconAgent(lat_lng, icon, agentmap);
}

//Add IconAgent to the AgentMaps namespace.
L.A.IconAgent = IconAgent;

/**
 * A user-defined callback function that returns a feature with appropriate geometry and properties to represent a iconagent.
 *
 * @callback iconAgentFeatureMaker
 * @param {number} id - The agent's Leaflet layer ID.
 * @returns {Point} - A GeoJSON Point object with geometry and other properties for the iconagent, including
 * a "place" property that will set the iconagent's initial {@link Place}, and an "icon" property that determines the icon which will depict the iconagent. 
 * All other provided properties will be transferred to the IconAgent object once it is created.
 * See {@link https://leafletjs.com/reference-1.3.2.html#marker} and {@link https://leafletjs.com/reference-1.3.2.html#marker} 
 * for all possible Icon and Marker options.
 *
 * @example
 * let icon_A = L.icon({			
 *	"iconUrl": "pic.jpg",			
 * 	"iconSize": [38, 95],
 * 	"iconAnchor": [22, 94]
 * }),
 * point = {					
 * 	"type": "Feature",				 
 * 	"properties": {					
 *		"icon": icon_A,
 * 		"place": {				
 * 			"type": "unit",			
 * 			"id": 89			
 * 		},								
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
 * A standard {@link iconagentFeatureMaker}, which sets an iconagent's location to be the point near the center of the i�� unit of the map,
 * its place property to be that unit's, and its layer_options to be red and of radius .5 meters.
 * @memberof Agentmap
 * @instance
 * @type {iconagentFeatureMaker}
 */
function seqUnitIconAgentMaker(id){
	let index = this.agents.count();

	let icon_A = L.icon({
		"iconUrl": "https://leafletjs.com/examples/custom-icons/leaf-orange.png",
		"iconSize": [38, 95],
		"iconAnchor": [22, 94]
	});
	
	if (index > this.units.getLayers().length - 1) {
		throw new Error("seqUnitIconAgentMaker cannot accommodate more agents than there are units.");
	}
	
	let unit = this.units.getLayers()[index],
	unit_id = this.units.getLayerId(unit),
	center_point = centroid(unit.feature);
	center_point.properties.place = {"type": "unit", "id": unit_id},
	center_point.properties.center_point.properties.icon = icon_A;
	
	return center_point;
}

/**
 * Generate some number of IconAgents and place them on the map.
 * @memberof Agentmap
 * @instance
 *
 * @param {number} count - The desired number of iconagents.
 * @param {iconagentFeatureMaker} iconagentFeatureMaker - A callback that determines an iconagent i's feature properties and geometry (always a Point).
 */
function IconAgentify(count, iconagentFeatureMaker) {
	let agentmap = this;

	if (!(this.agents instanceof L.LayerGroup)) {
		this.agents = L.featureGroup().addTo(this.map);
	}

	let agents_existing = agentmap.agents.getLayers().length;
	for (let i = agents_existing; i < agents_existing + count; i++) {
		let new_iconagent = iconagent(null, null, agentmap);
		
		//Callback function aren't automatically bound to the agentmap.
		let boundFeatureMaker = iconagentFeatureMaker.bind(agentmap),
		iconagent_feature = boundFeatureMaker(new_iconagent._leaflet_id);
		
		let coordinates = L.A.reversedCoordinates(iconagent_feature.geometry.coordinates),
		place = iconagent_feature.properties.place,
		icon = iconagent_feature.properties.icon;
		
		//Make sure the agent feature is valid and has everything we need.
		if (!L.A.isPointCoordinates(coordinates)) {
			throw new Error("Invalid feature returned from iconagentFeatureMaker: geometry.coordinates must be a 2-element array of numbers.");	
		}
		else if (typeof(place.id) !== "number") {
			throw new Error("Invalid feature returned from iconagentFeatureMaker: properties.place must be a {unit: unit_id} or {street: street_id} with an existing layer's ID.");	
		}

//markers dont have setStyle options like circleMarkers
		new_iconagent.setLatLng(coordinates);
		new_iconagent.setIcon(icon);
		new_iconagent.place = place;
		
		Object.assign(new_iconagent, iconagent_feature.properties);
		
		this.agents.addLayer(new_iconagent);
	}
}

exports.iconagent = iconagent,
exports.iconagentify = IconAgentify,
exports.seqUnitIconAgentMaker = seqUnitIconAgentMaker;
