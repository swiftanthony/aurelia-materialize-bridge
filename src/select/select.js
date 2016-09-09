import {bindable, customAttribute} from 'aurelia-templating';
import {BindingEngine} from 'aurelia-binding';
import {inject} from 'aurelia-dependency-injection';
import {TaskQueue} from 'aurelia-task-queue';
import * as LogManager from 'aurelia-logging';
import {fireEvent} from '../common/events';
import {DOM} from 'aurelia-pal';

@inject(Element, LogManager, BindingEngine, TaskQueue)
@customAttribute('md-select')
export class MdSelect {
  @bindable() disabled = false;
  @bindable() label = '';
  _suspendUpdate = false;
  subscriptions = [];
  input = null;
  dropdownMutationObserver = null;

  constructor(element, logManager, bindingEngine, taskQueue) {
    this.element = element;
    this.taskQueue = taskQueue;
    this.handleChangeFromViewModel = this.handleChangeFromViewModel.bind(this);
    this.handleChangeFromNativeSelect = this.handleChangeFromNativeSelect.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.log = LogManager.getLogger('md-select');
    this.bindingEngine = bindingEngine;
  }

  attached() {
    this.subscriptions.push(this.bindingEngine.propertyObserver(this.element, 'value').subscribe(this.handleChangeFromViewModel));
    // this.subscriptions.push(this.bindingEngine.propertyObserver(this.element, 'selectedOptions').subscribe(this.notifyBindingEngine.bind(this)));
    // $(this.element).material_select(() => {
    //   this.log.warn('materialize callback', $(this.element).val());
    //   this.handleChangeFromNativeSelect();
    // });
    this.createMaterialSelect(false);

    if (this.label) {
      let wrapper = $(this.element).parent('.select-wrapper');
      let div = $('<div class="input-field"></div>');
      let va = this.element.attributes.getNamedItem('validate');
      if (va) {
        div.attr(va.name, va.label);
      }
      wrapper.wrap(div);
      $(`<label>${this.label}</label>`).insertAfter(wrapper);
    }
    $(this.element).on('change', this.handleChangeFromNativeSelect);
  }

  detached() {
    $(this.element).off('change', this.handleChangeFromNativeSelect);
    this.observeVisibleDropdownContent(false);
    this.dropdownMutationObserver = null;
    $(this.element).material_select('destroy');
    this.subscriptions.forEach(sub => sub.dispose());
  }

  refresh() {
    this.taskQueue.queueTask(() => {
      this.createMaterialSelect(true);
    });
  }

  disabledChanged(newValue) {
    this.toggleControl(newValue);
  }

  notifyBindingEngine() {
    this.log.debug('selectedOptions changed', arguments);
  }

  handleChangeFromNativeSelect() {
    if (!this._suspendUpdate) {
      this.log.debug('handleChangeFromNativeSelect', this.element.value, $(this.element).val());
      this._suspendUpdate = true;
      fireEvent(this.element, 'change');
      this._suspendUpdate = false;
    }
  }

  handleChangeFromViewModel(newValue) {
    this.log.debug('handleChangeFromViewModel', newValue, $(this.element).val());
    if (!this._suspendUpdate) {
      this.createMaterialSelect(false);
    }
  }

  toggleControl(disable) {
    let $wrapper = $(this.element).parent('.select-wrapper');
    if ($wrapper.length > 0) {
      if (disable) {
        $('.caret', $wrapper).addClass('disabled');
        $('input.select-dropdown', $wrapper).attr('disabled', 'disabled');
        $wrapper.attr('disabled', 'disabled');
      } else {
        $('.caret', $wrapper).removeClass('disabled');
        $('input.select-dropdown', $wrapper).attr('disabled', null);
        $wrapper.attr('disabled', null);
        $('.select-dropdown', $wrapper).dropdown({'hover': false, 'closeOnClick': false});
      }
    }
  }

  createMaterialSelect(destroy) {
    this.observeVisibleDropdownContent(false);
    if (destroy) {
      $(this.element).material_select('destroy');
    }
    $(this.element).material_select();
    this.toggleControl(this.disabled);
    this.observeVisibleDropdownContent(true);
  }

  observeVisibleDropdownContent(attach) {
    if (attach) {
      if (!this.dropdownMutationObserver) {
        this.dropdownMutationObserver = DOM.createMutationObserver(mutations => {
          let isHidden = false;
          for (let mutation of mutations) {
            if (window.getComputedStyle(mutation.target).getPropertyValue('display') === 'none') {
              isHidden = true;
            }
          }
          if (isHidden) {
            this.dropdownMutationObserver.takeRecords();
            this.handleBlur();
          }
        });
      }
      this.dropdownMutationObserver.observe(this.element.parentElement.querySelector('.dropdown-content'), {
        attributes: true,
        attributeFilter: ['style']
      });
    } else {
      if (this.dropdownMutationObserver) {
        this.dropdownMutationObserver.disconnect();
        this.dropdownMutationObserver.takeRecords();
      }
    }
  }

  //
  // Firefox sometimes fire blur several times in a row
  // observable at http://localhost:3000/#/samples/select/
  // when enable 'Disable Functionality', open that list and
  // then open 'Basic use' list.
  // Chrome - ok
  // IE ?
  //
  _taskqueueRunning = false;

  handleBlur() {
    if (this._taskqueueRunning) return;
    this._taskqueueRunning = true;
    this.taskQueue.queueTask(() => {
      this.log.debug('fire blur event');
      fireEvent(this.element, 'blur');
      this._taskqueueRunning = false;
    });
  }
}
