/*
 *  Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 *  This file (logController.js) is part of LiteFarm.
 *
 *  LiteFarm is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  LiteFarm is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details, see <https://www.gnu.org/licenses/>.
 */

const baseController = require('../controllers/baseController');
const { transaction } = require('objection');
const { Model } = require('objection');
const ExceptionHandler = require('../LiteFarmUtility/exceptionHandler');
const lodash = require('lodash');

const ActivityLogModel = require('../models/activityLogModel');
const FertilizerLog = require('../models/fertilizerLogModel');
const PestControlLog = require('../models/pestControlLogModel');
const ScoutingLog = require('../models/scoutingLogModel');
const IrrigationLog = require('../models/irrigationLogModel');
const FieldWorkLog = require('../models/fieldWorkLogModel');
const SoilDataLog = require('../models/soilDataLogModel');
const SeedLog = require('../models/seedLogModel');
const fieldCrop = require('../models/fieldCropModel');
const HarvestLog = require('../models/harvestLogModel');
const field = require('../models/fieldModel');

class logController extends baseController {
  static addLog() {
    return async (req, res) => {
      const trx = await transaction.start(Model.knex());
      try{
        if(!lodash.isEmpty(req.body)){
          await logServices.insertLog(req, trx);
          await trx.commit();
        }
        res.sendStatus(200);
      }catch(exception){
        await trx.rollback();
        var error = ExceptionHandler.handleException(exception);
        res.status(error.status).json({ error: error.message });
      }
    };
  }

  static getLogByActivityId(){
    return async (req, res) => {
      try{
        if(req.params.activity_id){
          const activity_id = req.params.activity_id
          const log = await logServices.getLogById(activity_id);
          res.json(log);
        }else{
          res.status(200).json([]);
        }
      }catch(exception){
        const error = ExceptionHandler.handleException(exception);
        res.status(error.status).json({ error:error.message });
      }
    }
  }

  static getLogByFarmId(){
    return async (req, res) => {
      try{
        if(req.params.farm_id){
          const farm_id = req.params.farm_id
          const logs = await logServices.getLogByFarm(farm_id);
          if(logs && !logs.length){
            res.json([]);
          }else{
            res.json(logs);
          }
        }else{
          res.status(200).json([]);
        }
      }catch(exception){
        const error = ExceptionHandler.handleException(exception);
        res.status(error.status).json({ error:error.message });
      }
    }
  }

  static deleteLog(){
    return async (req, res) => {
      try{
        if(req.params.activity_id){
          await logServices.deleteLog(req.params.activity_id);
          res.sendStatus(200);
        }else{
          throw { code:400, message:'No log id defined' }
        }
      }catch(exception){
        //HANDLE USER UNABLE TO DELETE
        const error = ExceptionHandler.handleException(exception);
        res.status(error.status).json({ error: error.message });
      }
    }
  }

  static putLog(){
    return async(req, res)=>{
      const trx = await transaction.start(Model.knex());
      try{
        if(req.params.activity_id){
          await logServices.patchLog(req.params.activity_id, trx, req);
          await trx.commit();
          res.sendStatus(200);
        }else{
          throw { code:400, message:'No log id defined' }
        }

      }catch(exception){
        await trx.rollback();
        const error = ExceptionHandler.handleException(exception);
        res.status(error.status).json({ error: error.message });
      }
    }
  }
}

class logServices extends baseController {
  constructor() {
    super();
  }

  static async insertLog({ body, user }, transaction){
    const logModel = getActivityModelKind(body.activity_kind);
    const user_id = user.user_id;
    const activityLog = await super.post(ActivityLogModel, body, transaction, { user_id });

    //insert crops,fields and beds
    await super.relateModels(activityLog, fieldCrop, body.crops, transaction);
    await super.relateModels(activityLog, field, body.fields, transaction);
    if (!logModel.isOther) {
      await super.postRelated(activityLog, logModel, body, transaction);
    }
  }

  static async getLogById(id){
    const log = await super.getIndividual(ActivityLogModel, id);
    if(!(log && log[0])){
      throw new Error('Log not found');
    }
    const logKind = getActivityModelKind(log[0].activity_kind);
    if(logKind !== null){
      await super.getRelated(log[0], logKind);
    }
    return log[0];
  }

  static async getLogByFarm(farm_id){
    var logs = await ActivityLogModel.query().whereNotDeleted()
      .distinct('users.first_name', 'users.last_name', 'activityLog.activity_id', 'activityLog.activity_kind',
        'activityLog.date', 'activityLog.user_id', 'activityLog.notes', 'activityLog.action_needed', 'activityLog.photo')
      .join('activityFields', 'activityFields.activity_id', 'activityLog.activity_id')
      .join('field', 'field.field_id', 'activityFields.field_id')
      .join('userFarm', 'userFarm.farm_id', '=', 'field.farm_id')
      .join('users', 'users.user_id', '=', 'activityLog.user_id')
      .where('userFarm.farm_id', farm_id);
    for(var log of logs){
      // get fields and fieldCrops associated with log
      await log.$fetchGraph('fieldCrop.crop');
      await super.getRelated(log, field);

      // get related models for specialized logs
      var logKind = getActivityModelKind(log.activity_kind);
      if (!logKind.isOther) {
        await super.getRelated(log, logKind);
      }
    }
    return logs;
  }

  static async patchLog(logId, transaction, { body, user }){
    var log = await super.getIndividual(ActivityLogModel, logId);
    const user_id = user.user_id;
    const activityLog = await super.updateIndividualById(ActivityLogModel, logId, body, transaction, { user_id });

    //insert fieldCrops,fields
    // TODO: change body.crops to body.fieldCrops
    await super.relateModels(activityLog, fieldCrop, body.crops, transaction);
    // TODO: Deprecate fields field in req.body
    await super.relateModels(activityLog, field, body.fields, transaction);

    var logKind = getActivityModelKind(log[0].activity_kind);
    if (!logKind.isOther) {
      await super.updateIndividualById(logKind, logId, body, transaction, { user_id })
    }
  }

  static async deleteLog(logId, trasnaction){
    await super.delete(ActivityLogModel, logId, trasnaction);
  }
}

function getActivityModelKind(activity_kind){


  if(activity_kind === 'fertilizing'){
    return  FertilizerLog;
  }else if(activity_kind === 'pestControl'){
    return PestControlLog;
  }else if(activity_kind === 'scouting'){
    return ScoutingLog;
  }else if(activity_kind === 'irrigation'){
    return IrrigationLog;
  }else if(activity_kind === 'harvest'){
    return HarvestLog;
  }else if(activity_kind === 'fieldWork') {
    return FieldWorkLog;
  }else if(activity_kind === 'soilData'){
    return SoilDataLog;
  }else if(activity_kind === 'others'){
    return null;
  }else if(activity_kind === 'seeding'){
    return SeedLog;
  }else if(activity_kind === 'other'){
    return { isOther:true };
  }
  throw 'Unknown log type'
}

module.exports.logController = logController;
module.exports.logServices = logServices;
