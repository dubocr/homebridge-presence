import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    Characteristic,
    CharacteristicValue,
    HAP,
    Logging,
    Service,
} from 'homebridge';

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module
 * (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    hap = api.hap;
    api.registerAccessory('Presence', Presence);
};

class Presence implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly name: string;
    private readonly stateful: boolean;

    private readonly services: Array<Service>;

    private readonly motionDelay: number;
    private readonly occupancyDelay: number;

    private motionTimer: NodeJS.Timeout | null = null;
    private occupancyTimer: NodeJS.Timeout | null = null;

    private readonly motionTrigger: Characteristic;
    private readonly motion: Characteristic;
    private readonly occupancyTrigger: Characteristic;
    private readonly occupancy: Characteristic;

    constructor(log: Logging, config: AccessoryConfig) {
        this.log = log;
        this.name = config.name;
        this.stateful = config.stateful || false;
        this.motionDelay = config.motionDelay || (60 * 60);
        this.occupancyDelay = config.occupancyDelay || (12 * 60 * 60);

        const motionTriggerService = new hap.Service.Switch(this.name, 'Motion');
        const motionService = new hap.Service.MotionSensor(this.name);
        const occupancyTriggerService = new hap.Service.Switch(this.name, 'Occupancy');
        const occupancyService = new hap.Service.OccupancySensor(this.name);

        motionTriggerService.setCharacteristic(hap.Characteristic.Name, 'Motion');
        this.motionTrigger = motionTriggerService.getCharacteristic(hap.Characteristic.On);
        this.motion = motionService.getCharacteristic(hap.Characteristic.MotionDetected);

        occupancyTriggerService.setCharacteristic(hap.Characteristic.Name, 'Occupancy');
        this.occupancyTrigger = occupancyTriggerService.getCharacteristic(hap.Characteristic.On);
        this.occupancy = occupancyService.getCharacteristic(hap.Characteristic.OccupancyDetected);

        motionTriggerService.getCharacteristic(hap.Characteristic.On).onSet(this.onMotion.bind(this));
        occupancyTriggerService.getCharacteristic(hap.Characteristic.On).onSet(this.onOccupancy.bind(this));

        const informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, 'github.com/dubocr')
            .setCharacteristic(hap.Characteristic.Model, 'Presence');

        log.info('Presence service initialized!');

        this.services = [
            informationService,
            motionTriggerService,
            motionService,
            occupancyTriggerService,
            occupancyService,
        ];
    }

    private onMotion(value: CharacteristicValue) {
        if (this.motionTimer !== null) {
            clearTimeout(this.motionTimer);
        }

        if (this.occupancyTimer !== null) {
            clearTimeout(this.occupancyTimer);
        }
        if (value) {
            this.motion.updateValue(true);
            this.occupancy.updateValue(true);
            this.occupancyTrigger.updateValue(true);
            if (!this.stateful) {
                setTimeout(() => this.motionTrigger.setValue(false), 1000);
            }
        } else {
            this.motionTimer = setTimeout(
                () => this.motion.updateValue(false),
                (this.motionDelay * 1000),
            );
        }
    }

    private onOccupancy(value: CharacteristicValue) {
        if (this.motionTimer !== null) {
            clearTimeout(this.motionTimer);
        }
        if (this.occupancyTimer !== null) {
            clearTimeout(this.occupancyTimer);
        }
        if (value) {
            this.occupancy.updateValue(true);
        } else {
            this.motion.updateValue(false);
            this.motionTrigger.updateValue(false);

            this.occupancyTimer = setTimeout(
                () => this.occupancy.updateValue(false),
                (this.occupancyDelay * 1000),
            );
        }
    }

    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify(): void {
        this.log('Identify !');
    }

    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices(): Service[] {
        return this.services;
    }
}