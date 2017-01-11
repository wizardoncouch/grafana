///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

import config from 'app/core/config';
import {coreModule, appEvents} from 'app/core/core';

import './options';
import './add_panel';
import {DashboardRow} from './row_model';
import angular from 'angular';

export class DashRowCtrl {
  dashboard: any;
  row: any;
  dropView: number;
  dashboards: any;
  showDupRow: number;

  /** @ngInject */
  constructor(private $http, private $scope, private $rootScope, private $timeout, private backendSrv,) {
    this.row.title = this.row.title || 'Row title';

    this.showDupRow = 0;

    if (this.row.isNew) {
      this.dropView = 1;
    }
    this.backendSrv.search().then((results) => {
      this.dashboards = results;
    });
  }
  hideDupSubMenu(){
    var self = this;
    this.$timeout(function() {
      self.showDupRow = 0;
    }, 500);
  }
  showDupSubMenu(){
    this.showDupRow = 1;
  }
  saveRowToDashboard(dash) {
    this.backendSrv.post('/api/dashboards/db/', {dashboard: dash}).then((results) => {
      this.$rootScope.appEvent('alert-success', ['Copy Row', 'Success']);
    });
  }
  copyRowtoDashboard(dash) {

    this.backendSrv.get('/api/dashboards/'+dash.uri).then((results) => {
      var dashboard = results.dashboard;
      var newRow = {
        collapse : this.row.collapse,
        height : this.row.height,
        panels : [],
        repeat : this.row.repeat,
        repeatIteration : this.row.repeatIteration,
        repeatRowId : this.row.repeatRowId,
        showTitle : this.row.showTitle,
        title : this.row.title,
        titleSize : this.row.titleSize,
      };
      var i, j, row, panel, max = 0;
      for (i = 0; i < dashboard.rows.length; i++) {
        row = dashboard.rows[i];
        for (j = 0; j < row.panels.length; j++) {
          panel = row.panels[j];
          if (panel.id > max) { max = panel.id; }
        }
      }
      var newPanelId = max + 1;
      for ( var cnt in this.row.panels ) {
        var panel = this.row.panels[cnt];
        var newPanel = angular.copy(panel);
        newPanel.id = newPanelId;
        delete newPanel.repeat;
        delete newPanel.repeatIteration;
        delete newPanel.repeatPanelId;
        delete newPanel.scopedVars;
        delete newPanel.alert;
        newRow.panels.push(newPanel);
        newPanelId++;
      }
      dashboard.rows.push(newRow);
      this.saveRowToDashboard(dashboard);
    });
  }

  duplicateRow() {
    console.log(this.dashboard);
    var defaults = {
      title: this.row.title,
      showTitle: this.row.showTitle,
      titleSize: this.row.titleSize,
      isNew: false,
      span: this.row.span,
      height: this.row.height,
      collapse: this.row.collapse
    };
    var newRow = new DashboardRow(defaults);
    this.dashboard.rows.push(newRow);
    for ( var i in this.row.panels ) {
      var panel = this.row.panels[i];
      var newPanel = angular.copy(panel);
      newPanel.id = this.dashboard.getNextPanelId();

      delete newPanel.repeat;
      delete newPanel.repeatIteration;
      delete newPanel.repeatPanelId;
      delete newPanel.scopedVars;
      delete newPanel.alert;
      newRow.addPanel(newPanel);
    };
    var rowsList = this.dashboard.rows;
    var rowIndex = _.indexOf(rowsList, this.row);
    var newRowIndex = _.indexOf(rowsList, newRow);

    var updateIndex = rowIndex + 1;

    if (updateIndex >= 0 && updateIndex <= (rowsList.length - 1)) {
      _.move(rowsList, newRowIndex, updateIndex);
    }

  }

  onDrop(panelId, dropTarget) {
    var dragObject;

    // if string it's a panel type
    if (_.isString(panelId)) {
      // setup new panel
      dragObject = {
        row: this.row,
        panel: {
          title: config.new_panel_title,
          type: panelId,
          id: this.dashboard.getNextPanelId(),
          isNew: true,
        },
      };
    } else {
      dragObject = this.dashboard.getPanelInfoById(panelId);
    }

    if (dropTarget) {
      dropTarget = this.dashboard.getPanelInfoById(dropTarget.id);
      // if draging new panel onto existing panel split it
      if (dragObject.panel.isNew) {
        dragObject.panel.span = dropTarget.panel.span = dropTarget.panel.span/2;
        // insert after
        dropTarget.row.panels.splice(dropTarget.index+1, 0, dragObject.panel);
      } else if (this.row === dragObject.row) {
        // just move element
        this.row.movePanel(dragObject.index, dropTarget.index);
      } else {
        // split drop target space
        dragObject.panel.span = dropTarget.panel.span = dropTarget.panel.span/2;
        // insert after
        dropTarget.row.panels.splice(dropTarget.index+1, 0, dragObject.panel);
        // remove from source row
        dragObject.row.removePanel(dragObject.panel, false);
      }
    } else {
      dragObject.panel.span = 12 - this.row.span;
      this.row.panels.push(dragObject.panel);

      // if not new remove from source row
      if (!dragObject.panel.isNew) {
        dragObject.row.removePanel(dragObject.panel, false);
      }
    }

    this.dropView = 0;
    this.row.panelSpanChanged();
    this.$timeout(() => {
      this.$rootScope.$broadcast('render');
    });
  }

  setHeight(height) {
    this.row.height = height;
    this.$scope.$broadcast('render');
  }

  moveRow(direction) {
    var rowsList = this.dashboard.rows;
    var rowIndex = _.indexOf(rowsList, this.row);
    var newIndex = rowIndex + direction;

    if (newIndex >= 0 && newIndex <= (rowsList.length - 1)) {
      _.move(rowsList, rowIndex, newIndex);
    }
  }

  toggleCollapse() {
    this.closeDropView();
    this.row.collapse = !this.row.collapse;
  }

  onMenuAddPanel() {
    this.dropView = 1;
  }

  onMenuRowOptions() {
    this.dropView = 2;
  }

  closeDropView() {
    this.dropView = 0;
  }

  onMenuDeleteRow() {
    this.dashboard.removeRow(this.row);
  }
}

coreModule.directive('dashRow', function($rootScope) {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/row.html',
    controller: DashRowCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "=",
      row: "=",
    },
    link: function(scope, element) {
      scope.$watchGroup(['ctrl.row.collapse', 'ctrl.row.height'], function() {
        element.toggleClass('dash-row--collapse', scope.ctrl.row.collapse);
        element.find('.panels-wrapper').css({minHeight: scope.ctrl.row.collapse ? '5px' : scope.ctrl.row.height});
      });

      $rootScope.onAppEvent('panel-fullscreen-enter', function(evt, info) {
        var hasPanel = _.find(scope.ctrl.row.panels, {id: info.panelId});
        if (!hasPanel) {
          element.hide();
        }
      }, scope);

      $rootScope.onAppEvent('panel-fullscreen-exit', function() {
        element.show();
      }, scope);


    }
  };
});

coreModule.directive('panelWidth', function($rootScope) {
  return function(scope, element) {
    var fullscreen = false;

    function updateWidth() {
      if (!fullscreen) {
        element[0].style.width = ((scope.panel.span / 1.2) * 10) + '%';
      }
    }

    $rootScope.onAppEvent('panel-fullscreen-enter', function(evt, info) {
      fullscreen = true;

      if (scope.panel.id !== info.panelId) {
        element.hide();
      } else {
        element[0].style.width = '100%';
      }
    }, scope);

    $rootScope.onAppEvent('panel-fullscreen-exit', function(evt, info) {
      fullscreen = false;

      if (scope.panel.id !== info.panelId) {
        element.show();
      }

      updateWidth();
    }, scope);

    scope.$watch('panel.span', updateWidth);

    if (fullscreen) {
      element.hide();
    }
  };
});


coreModule.directive('panelDropZone', function($timeout) {
  return function(scope, element) {
    var row = scope.ctrl.row;
    var dashboard = scope.ctrl.dashboard;
    var indrag = false;
    var textEl = element.find('.panel-drop-zone-text');

    function showPanel(span, text) {
      element.find('.panel-container').css('height', row.height);
      element[0].style.width = ((span / 1.2) * 10) + '%';
      textEl.text(text);
      element.show();
    }

    function hidePanel() {
      element.hide();
    }

    function updateState() {
      if (row.panels.length === 0 && indrag === false) {
        return showPanel(12, 'Empty Space');
      }

      var dropZoneSpan = 12 - row.span;
      if (dropZoneSpan > 0) {
        if (indrag)  {
          return showPanel(dropZoneSpan, 'Drop Here');
        } else {
          return showPanel(dropZoneSpan, 'Empty Space');
        }
      }

      if (indrag === true) {
        var dropZoneSpan = 12 - row.span;
        if (dropZoneSpan > 1) {
          return showPanel(dropZoneSpan, 'Drop Here');
        }
      }

      hidePanel();
    }

    row.events.on('span-changed', updateState, scope);

    scope.$on("ANGULAR_DRAG_START", function() {
      indrag = true;
      updateState();
    });

    scope.$on("ANGULAR_DRAG_END", function() {
      indrag = false;
      updateState();
    });

    updateState();
  };
});

