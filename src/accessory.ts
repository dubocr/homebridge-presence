import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
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
  api.registerAccessory("Presence", Presence);
};

class Presence implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private triggers: Trigger[] = [];

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    for(const trigger of config.triggers) {
      this.triggers.push(new Trigger(trigger.name, trigger.delay));
    }

    this.switchService = new hap.Service.Switch(this.name);

    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.triggers.forEach((trigger: Trigger) => {
          trigger.setOccupancy(true);
          if(trigger.timer != null) {
            clearTimeout(trigger.timer);
          }
          trigger.timer = setTimeout(() => trigger.setOccupancy(false), (trigger.delay * 1000))
        });
        setTimeout(() => this.switchService.getCharacteristic(hap.Characteristic.On).updateValue(false), (1000));
        callback();
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Custom Manufacturer")
      .setCharacteristic(hap.Characteristic.Model, "Custom Model");

    log.info("Switch finished initializing!");
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ].concat(this.triggers.map((trigger) => trigger.service));
  }

}

class Trigger {
  public readonly name: string;
  public readonly delay: number;
  public readonly service: Service;
  public timer: NodeJS.Timeout|null = null;

  constructor(name: string, delay: number) {
    this.name = name;
    this.delay = delay;
    this.service = new hap.Service.OccupancySensor(name, name);
  }

  setOccupancy(occupancy: boolean) {
    this.service.getCharacteristic(hap.Characteristic.OccupancyDetected).updateValue(occupancy);
  }
}
