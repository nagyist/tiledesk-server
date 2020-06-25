var express = require('express');
var router = express.Router();
var Project = require("../models/project");
var winston = require('../config/winston');
var Project_user = require("../models/project_user");
var operatingHoursService = require("../services/operatingHoursService");
var AnalyticResult = require("../models/analyticResult");
var Department = require("../models/department");
var RoleConstants = require("../models/roleConstants");
var cacheUtil = require('../utils/cacheUtil');

router.get('/load', function(req, res, next) {
  winston.debug(req.projectid);
  
  // https://stackoverflow.com/questions/24258782/node-express-4-middleware-after-routes
  next();      // <=== call next for following middleware 
  // redirect to widget
});

router.get('/', function(req, res, next) {
    winston.debug(req.projectid);


    var availableUsers = function() {
      winston.debug('availableUsers:');
      return new Promise(function (resolve, reject) {
      operatingHoursService.projectIsOpenNow(req.projectid, function (isOpen, err) {    
          winston.debug('isOpen:'+ isOpen);
          if (isOpen) {            
            Project_user.find({ id_project: req.projectid, user_available: true, role: { $in : [RoleConstants.OWNER, RoleConstants.ADMIN, RoleConstants.AGENT]} }).
              populate('id_user').
              exec(function (err, project_users) {
                winston.debug('project_users:'+ project_users);
                if (project_users) {    
                  user_available_array = [];
                  project_users.forEach(project_user => {
                    if (project_user.id_user) {
                      user_available_array.push({ "id": project_user.id_user._id, "firstname": project_user.id_user.firstname });
                    } else {
                      winston.debug('else:');
                    }
                  });      
                  winston.debug('user_available_array:'+ JSON.stringify(user_available_array));          
                  return resolve(user_available_array);
                }
              });
          } else {          
            return resolve([]);
          }
        });
      });
  };

  var waiting = function() {
    return new Promise(function (resolve, reject) {
      AnalyticResult.aggregate([
        //last 4
        { $match: {"id_project":req.projectid, "createdAt" : { $gte : new Date((new Date().getTime() - (4 * 60 * 60 * 1000))) }} },
        { "$group": { 
          "_id": "$id_project", 
        "waiting_time_avg":{"$avg": "$waiting_time"}
        }
      },
      
    ])
    // .cache(cacheUtil.longTTL, req.projectid+":analytics:query:waiting:avg:4hours")        
    .exec(function(err, result) {
          return resolve(result);
    });
  });
  };

  var getIp = function() {
    return new Promise(function (resolve, reject) {
    //  var ip = req.ip;
    var ip = req.headers['x-forwarded-for'] || 
     req.connection.remoteAddress || 
     req.socket.remoteAddress ||
     (req.connection.socket ? req.connection.socket.remoteAddress : null);
      winston.info("ip:"+ ip);
      return resolve(ip);
  });
  };



  // var departments = function() {
    
  //     return Department.find({ "id_project": req.projectid, "status": 1 }).exec(
  // };
  

// TOOD add labels
    Promise.all([
        Project.findOne({_id: req.projectid, status: 100}).select('-settings')
        .cache(cacheUtil.queryTTL, "projects:query:id:status:100:"+req.projectid+":select:-settings")        
      ,
        availableUsers()
      ,
        Department.find({ "id_project": req.projectid, "status": 1 })
      ,
        waiting()
      , 
        getIp()
     

    ]).then(function(all) {
      let result = {project: all[0], user_available: all[1], departments: all[2], waiting: all[3]};
      res.json(result);
      // https://stackoverflow.com/questions/24258782/node-express-4-middleware-after-routes
      next();      // <=== call next for following middleware 

    });


  });



  


  

  


module.exports = router;
