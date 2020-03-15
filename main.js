'use strict';

/*
 * Created with @iobroker/create-adapter v1.17.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
const http = require('http');

let hybridFlags = {
	devicename : {type: 'string'},	
	provis_inet : {type: 'string'},
	provis_voip : {type: 'string'},
	router_state : {type: 'string'},
	onlinestatus : {type: 'boolean', compare : 'online'},
	use_lte : {type: 'boolean', compare : '1'},
	bonding_status : {type: 'boolean', compare : 'Online'},
	lte_signal  : {type: 'integer'},
	datetime  : {type: 'string'},
	dsl_link_status : {type: 'boolean', compare : 'online'},
	dsl_errnr : {type: 'string'},
	status: {type: 'boolean', compare : 'online'},
	dsl_downstream:  {type: 'integer'},
	dsl_upstream: {type: 'integer'},
};

/* Unused 
	ppp_bnguser: 'value: 0',
	bngscrat: 'value: 0',
	support_https: 'value: 0',
	title: 'page_title: Speedport Hybrid Konfigurationsprogramm',
	lte_status: 'value: 10',  ???
	loginstate: 'status: 0',
	imei: 'value: 864230023548256',

	fail_reason: 'value: ',
	inet_errnr: 'value: ',
	connect: 'value: 0',
	use_dect: 'value: 0',
	wlan_ssid: 'value: TM_SH',
	wlan_5ghz_ssid: 'value: TM_SH',
	use_wlan: 'value: 1',
	use_wlan_5ghz: 'value: 1',
	wlan_devices: 'value: 0',
	wlan_5ghz_devices: 'value: 0',
	lan1_device: 'value: 1',
	lan2_device: 'value: 0',
	lan3_device: 'value: 0',
	lan4_device: 'value: 0',
	use_wps: 'value: 1',
	hsfon_status: 'value: 2',
	firmware_version: 'value: 050124.04.00.005',
	serial_number: 'value: HF43702208' ]
*/

class SpeedportHybrid extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'speedport_hybrid',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('objectChange', this.onObjectChange.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		this.timer=undefined;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info('config speedportURL: ' + this.config.speedportURL);
		this.log.info('config Refresh: ' + this.config.refresh);

		/*
		For every state in the system there has to be also an object of type state
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		/*
		await this.setObjectAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});
		*/
		for (var name in hybridFlags) {
			this.setObjectAsync(name, {
				type: 'state',
				common: {
					name: name,
					type: hybridFlags[name]['type'],
					role: 'indicator',
					read: true,
					write: true,
				},
				native: {},
			});
		};

		// in this template all states changes inside the adapters namespace are subscribed
		this.subscribeStates('*');

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync('admin', 'iobroker');
		this.log.info('check user admin pw ioboker: ' + result);

		result = await this.checkGroupAsync('admin', 'admin');
		this.log.info('check group user admin group admin: ' + result);

		this.querySpeedport();
	}

	setSpeedportValues(value,index,array) {

	}
	/**
	 * Main function querying the Speedport Hybrid
	 */
	async querySpeedport() {
		var url='http://'+this.config.speedportURL+'/data/Status.json';
		this.log.info('Start query Speedport '+url);
		
		http.get(url, (res) => {
			this.log.info("Starting get Request");
    		var body='';

    		res.on('data', (chunk) => {
        		body+=chunk;
    		});

    		res.on('end',() => {
        		var result=[];
        		var speedportResponse=JSON.parse(body);
        		speedportResponse.forEach((value, index, array) => {
                	if ((value['vartype'] == 'value') ||
                    	(value['vartype'] == 'status') ||
                    	(value['vartype'] == 'option') ||
                    	(value['vartype'] == 'page_title')) {
						result[value['varid']]=value['varvalue'];
						
						if (hybridFlags.hasOwnProperty(value['varid'])) {
							if (hybridFlags[value['varid']]['type'] == 'boolean') {
								let boolVal=(value['varvalue'].toUpperCase() == hybridFlags[value['varid']]['compare'].toUpperCase());
								this.setStateAsync(value['varid'], { val: boolVal, ack: true });
							} else {
								this.setStateAsync(value['varid'], { val: value['varvalue'], ack: true });
							}
						}
                	}
        		});
        		//console.dir(result);
    		});
		}).on('error', (e) => {
    		this.log.info("Got an error: "+e);
		});
		let nextStart=parseInt(this.config.refresh);
		if (nextStart < 10000) nextStart=10000;
		this.timer=setTimeout(this.querySpeedport.bind(this),nextStart); //Restart this one
	}
	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.timer) clearTimeout(this.timer);
			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if (obj) {
			// The object was changed
			this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this.log.info(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.message" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new SpeedportHybrid(options);
} else {
	// otherwise start the instance directly
	new SpeedportHybrid();
}