angular.module('driverSide.profile', ['ngCookies'])
.controller('profileController', function($scope, $http, $rootScope, $cookies, $state){

  $scope.socket;
  $scope.socket = io();
  $scope.userId = JSON.parse($cookies.get('user')).id;
  $scope.orders = [];
  $scope.ordersDone = 0;
  $scope.jobId = null;
  $scope.hasJob;
  
  var watchID = navigator.geolocation.watchPosition(function(position) {
    sendPosToRedis(position.coords.latitude, position.coords.longitude, $scope.userId, function(){
      console.log('location saved');
    });
  });

  var sendPosToRedis = function(lat, lon, driverId, callback){
    $http({
      method: "POST",
      url: 'http://127.0.0.1:8000/api/driver/updateLocation',
      data: { driverId: driverId, lat: lat, lon: lon }
    }).then(function(result){
      callback();
    });
  };

  $scope.signOut = function(){
    navigator.geolocation.clearWatch(watchID);
    sendPosToRedis(0,0,$scope.userId, function(){
      $state.go('login');
    });
  };

  $rootScope.socketConnect = function(){
    $scope.socket.on('dequeue', function(job){
      if (job === false){
        console.log('empty job');
        return;
      }

      $scope.ordersIds = [];
      $scope.jobId = job.jobId;

      for (var i=0; i<job.orders.length; i++){
        $scope.ordersIds.push(job.orders[i].id);
      }

      $http({
        method: "POST",
        url: '/api/getorders',
        data: {
          orderIds: $scope.ordersIds,
          userId: $scope.userId
        }
      }).then(function(result){
        $scope.orders = result.data;
        $scope.hasJob = true;
        watchID = navigator.geolocation.watchPosition(function(position) {
          sendPosToRedis(position.coords.latitude, position.coords.longitude, $scope.userId, function(){
            console.log('location saved');
          });
        });
      });
    });
  };

  $scope.checkJobs = function(){
    $http({
      method: "GET",
      url: '/api/myJob'
    }).then(function(result){
      var job = result.data;
      job = JSON.parse(job);
      if (!job){
        $scope.hasJob = false;
      }else{
        $scope.hasJob = true;
        $scope.orders = job;
      }
    });
  };

  $scope.doneOrderIsReady = function(orderId, phone){
    $http({
      method: "POST",
      url: 'http://127.0.0.1:8000/api/driverNotifications/doneOrderReceived',
      data: { orderId: orderId, phone: phone }
    }).then(function(result){
      var myElement = angular.element(document.querySelector('#orderReady_' + orderId));
      myElement.attr('disabled', true);
    });
  };

  $scope.doneOrderIsOnItsWay = function(orderId, phone){
    $http({
      method: "POST",
      url: 'http://127.0.0.1:8000/api/driverNotifications/doneInProgress',
      data: { orderId: orderId, phone: phone }
    }).then(function(result){
      var myElement = angular.element(document.querySelector('#orderOnWay_' + orderId));
      myElement.attr('disabled', true);
    });
  };

  $scope.doneOrderDelivered = function(orderId, phone){
    $http({
      method: "POST",
      url: 'http://127.0.0.1:8000/api/driverNotifications/doneOntheWay',
      data: { orderId: orderId, phone: phone }
    }).then(function(result){
      var myElement = angular.element(document.querySelector('#orderDelivered_' + orderId));
      myElement.attr('disabled', true);

      $scope.ordersDone++;
      if ($scope.ordersDone === $scope.orders.length){
        $http({
          method: "POST",
          url: '/api/finishJob',
          data: {
            jobId: $scope.jobId,
            userId: $scope.userId
          }
        }).
        then(function(result){
          $scope.ordersDone = 0;
          $scope.orders = [];
          $scope.hasJob = false;
          navigator.geolocation.clearWatch(watchID);
          sendPosToRedis(0,0,$scope.userId, function(){
            
          });
        });
      }
    });
  };

  $scope.getJob = function(){
    $scope.socket.emit('request', $scope.userId);
  };
});