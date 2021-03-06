const {
  updateVehicleStatus,
  getVehicle,
  getVehicles,
  addNewVehicle,
  updateVehiclePosition
} = require('../store/vehicles');
const { getMission, updateMission } = require('../store/missions');
const { createMissionUpdate } = require('../store/mission_updates');
const Rx = require('rxjs/Rx');

class SkySenseCaptain {
  constructor() {
  }

  async init() {
    this.updates = Rx.Observable.timer(0, 1000).subscribe(async () => {
      try {
        // await this.updateVehicles();
      } catch (error) {
        console.error(error);
      }
    });
  }

  async dispose() {
    this.updates.unsubscribe();
  }

  async beginMission(vehicleId, missionId) {
    const missionUpdates = Rx.Observable.timer(0, 1000)
      .mergeMap(async () => {
        let mission = await getMission(missionId);
        let vehicle = await getVehicle(mission.vehicle_id);
        return { mission, vehicle };
      })
      .distinctUntilChanged(
        (state1, state2) =>
          state1.mission.status === state2.mission.status &&
          state1.vehicle.status === state2.vehicle.status
      )
      .subscribe(
        async state => {
          try {
            switch (state.mission.status) {
              case 'awaiting_signatures':
                break;
              case 'in_progress':
                await this.onInProgress(
                  state.mission,
                  state.vehicle
                );
                break;
              case 'in_mission':
                await this.onInMission(
                  state.mission,
                  state.vehicle
                );
                break;
              case 'completed':
                missionUpdates.unsubscribe();
                break;
              default:
                console.log(`bad mission.status ${state.mission}`);
                break;
            }
          } catch (error) {
            console.error(error);
          }
        },
        error => {
          console.error(error);
        }
      );
  }

  async onInProgress(mission, vehicle) {
    await updateMission(mission.mission_id, {
      status: 'in_mission',
      // vehicle_start_longitude: droneState.location.lon,
      // vehicle_start_latitude: droneState.location.lat
    });

    await this.onInMission(mission, vehicle);
  }

  async onInMission(mission, vehicle) {
    await updateVehiclePosition(
      vehicle,
      // droneState.location.lon,
      // droneState.location.lat
    );


    switch (vehicle.status) {
      case 'contract_received':
        await this.updateStatus(mission, 'takeoff_start', 'takeoff_start');
        break;
      case 'takeoff_start':
        setTimeout(async () => {
          await this.updateStatus(mission, 'travelling_pickup', 'travelling_pickup');
        }, 3000);
        break;
      case 'travelling_pickup':
        setTimeout(async () => {
          await this.updateStatus(mission, 'landing_pickup', 'landing_pickup');
        }, 3000);
        break;
      case 'landing_pickup':
        setTimeout(async () => {
          await this.updateStatus(mission, 'waiting_pickup', 'waiting_pickup');
        }, 3000);
        break;
      case 'waiting_pickup':
        console.log(`drone waiting for pickup`);
        break;
      case 'takeoff_pickup':
        await this.updateStatus(
          mission,
          'takeoff_pickup_wait',
          'takeoff_pickup_wait'
        );
        break;
      case 'takeoff_pickup_wait':
        setTimeout(async () => {
          await this.updateStatus(mission, 'travelling_dropoff', 'travelling_dropoff');
        }, 3000);
        break;
      case 'travelling_dropoff':
        setTimeout(async () => {
          await this.updateStatus(mission, 'landing_dropoff', 'landing_dropoff');
        }, 3000);
        break;
      case 'landing_dropoff':
        setTimeout(async () => {
          await this.updateStatus(
            mission,
            'waiting_dropoff',
            'waiting_dropoff'
          );
        }, 3000);
        break;
      case 'waiting_dropoff':
        setTimeout(async () => {
          await this.updateStatus(mission, 'completed', 'available');
        }, 3000);
        break;
      case 'available':
        await updateMission(mission.mission_id, {
          status: 'completed'
        });
        break;
      default:
        console.log(`bad vehicle.status ${vehicle}`);
        break;
    }
  }

  async updateStatus(mission, missionStatus, vehicleStatus) {
    await updateMission(mission.mission_id, {
      [missionStatus + '_at']: Date.now()
    });
    await createMissionUpdate(mission.mission_id, missionStatus);
    await updateVehicleStatus(mission.vehicle_id, vehicleStatus);
  }

  async updateVehicle(drone) {
    let vehicles = await getVehicles([drone.davId]);
    if (vehicles.length > 0) {
      let vehicle = vehicles[0];
      vehicle.coords = {
        // long: state.location.lon,
        // lat: state.location.lat
      };
      updateVehiclePosition(vehicle);
    } else {
      let vehicle = {
        id: drone.davId,
        model: 'CopterExpress-d1',
        icon: `https://lorempixel.com/100/100/abstract/?${drone.davId}`,
        coords: {
          // long: state.location.lon,
          // lat: state.location.lat
        },
        missions_completed: 0,
        missions_completed_7_days: 0,
        status: 'available'
      };
      addNewVehicle(vehicle);
    }
  }

  getBid() {
    const bidInfo = {
      price: '10',
      price_type: 'flat',
      price_description: 'Flat fee',
      time_to_pickup: 1,
      time_to_dropoff: 1,
      drone_manufacturer: 'SkySense',
      drone_model: 'Charger',
      expires_at: Date.now() + 3600000,
      ttl: 120 // TTL in seconds
    };

    return bidInfo;
  }
}

module.exports = new SkySenseCaptain();
