/* global jQuery, Handlebars, Sortable */
/* global game, loadTemplates, mergeObject, Application, FormApplication, Dialog */

import { Aspect, Tracker } from "./tracker.js";
import { RGBColor } from "./colors.js";
import Socket from "./socket.js";

/**
 * Parse handlebar templates included with the aspect tracker.
 * @returns {Promise<Array<Function>>} an array of functions used for rendering the templates
 */
async function preloadTemplates() {
  const templates = [
    "modules/fate-aspect-tracker/templates/aspect-list.hbs",
    "modules/fate-aspect-tracker/templates/aspect-item-form.hbs",
  ];

  Handlebars.registerHelper("tags", function(tag, options) {
    const tags = tag.split(',');
    const tagsAsHtml = tags.map(tag => options.fn(tag));
    return tagsAsHtml.join("\n");
  });

  Handlebars.registerHelper('hideAspect', function(hidden, GM, options) {
    if(!hidden || GM) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  return loadTemplates(templates);
}

export class AspectTrackerWindow extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "fate-aspect-tracker-app",
      template: "modules/fate-aspect-tracker/templates/aspect-list.hbs",
      width: 400,
      height: 300,
      minimizable: true,
      resizable: true,
      title: game.i18n.localize("FateAspectTracker.aspecttrackerwindow.title"),
    });
  }

  /**
   * Set up interactivity for the window.
   *
   * @param {JQuery} html is the rendered HTML provided by jQuery
   **/
  activateListeners(html) {
    super.activateListeners(html);

    const listEl = html.find("#fate-aspect-tracker-list").get(0);
    if (listEl) {
      Sortable.create(listEl, {
        revertOnSpill: true,
        onEnd: async (evt) => {
          if (evt.oldIndex == evt.newIndex) return;

          const data = window.aspectTrackerWindow.getData();
          if(data.GM) {
            const list = data.tracker;
            await list.moveAspect(evt.oldIndex, evt.newIndex);
          }
        },
        onSpill: async (evt) => {
          const data = window.aspectTrackerWindow.getData();
          if(data.GM) {
            const list = data.tracker;
            await list.creatTextAspect(evt.oldIndex, evt.originalEvent.clientX, evt.originalEvent.clientY);
          }
        },
      });
    }

    html.on("click", "a.aspect-control", async function () {
      const index = jQuery(this).data("index");
      const action = jQuery(this).data("action");

      const list = window.aspectTrackerWindow.getData().tracker;

      switch (action) {
        case "aspect-delete":
          await list.deleteAspect(index);
          break;
        case "aspect-increase-invoke":
          await list.increaseInvoke(index);
          break;
        case "aspect-decrease-invoke":
          await list.decreaseInvoke(index);
          break;
        case "aspect-edit":
          new AspectForm(list.aspects[index], index).render(true);
          break;
        case "aspect-toggle":
          await list.toggleVisibility(index);
          break;
        default:
          return;
      }

      window.aspectTrackerWindow.render(true);
    });

    html.on("click", "button.aspect-new", async function () {
      new AspectForm(undefined, undefined).render(true);
    });

    // tags are colored based on the aspect color
    html.find("#fate-aspect-tracker-list span.tag").each(function () {
      const tag = jQuery(this);

      // we use the computed color if the description
      // this lets use work with aspects that don't have a color
      const desc = tag.siblings("p.aspect-description");
      const color = desc.css("color");
      const parsed = RGBColor.parse(color);
      const contrast = parsed.contrastColor();

      tag.css("background-color", parsed.toCSS());
      tag.css("color", contrast.toCSS());

      // we base the border color on the regular text color
      const control = tag.siblings("a.aspect-control");
      const borderColor = control.css("color");
      tag.css("border-color", borderColor);
    });
    
  }

  /**
   * @returns {Tracker}
   * @returns {boolean}
   */
  getData() {
    return {
      tracker: Tracker.load(),
      GM: game.user.isGM,
    };
  }

  /**
   * 
   * 
   */
   _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    // Edit mode button to toggle which interactive elements are visible on the sheet.
    if (game.user?.isGM) {
      buttons.unshift(
          {
              class: "fat-show-player",
              label: game.i18n.localize("FateAspectTracker.aspecttrackerwindow.showplayers"),
              icon: "fas fa-eye",
              onclick: (e) => Socket.showTrackerToPlayers(),
          }
      );
    }

    return buttons;
  }
}

class AspectForm extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "fate-aspect-tracker-form",
      template: "modules/fate-aspect-tracker/templates/aspect-item-form.hbs",
      width: 400,
      minimizable: false,
      closeOnSubmit: true,
      title: game.i18n.localize("FateAspectTracker.aspectform.title"),
    });
  }

  /**
   * @param {Aspect} aspect is the (optional) aspect to edit
   * @param {number?} index is the (optional) index in the to-do list
   **/
  constructor(aspect, index) {
    super();

    this.aspect = aspect ?? new Aspect();
    this.index = index;
  }

  /**
   * Set up interactivity for the form.
   *
   * @param {JQuery} html is the rendered HTML provided by jQuery
   **/
  activateListeners(html) {
    super.activateListeners(html);

  }

  /** @override */
  getData() {
    return {
      index: this.index,

      aspect: this.aspect,
    };
  }

  /** @override */
  async _updateObject(_event, data) {
    const aspect = new Aspect(data.description, data.tag, data.color, data.invoke);

    aspect.globalScope = data.globalScope;

    const list = Tracker.load();
    if (data.index) await list.updateAspect(data.index, aspect);
    else await list.appendAspect(aspect);

    window.aspectTrackerWindow.render(true);
  }
}

/**
 * Setup the to-do list window. Adds a button to the journal directory.
 *
 * @param {JQuery} html is the rendered HTML provided by jQuery
 **/
function setupAspectTrackerWindow(html) {
  window.aspectTrackerWindow = new AspectTrackerWindow();
}

/**
 * Initialize relevant UI components:
 * - preloads relevant templates
 * - adds trigger button to journal
 *
 * @param {JQuery} html is the rendered HTML provided by jQuery
 **/
export async function initUiComponents(html) {
  await preloadTemplates();

  setupAspectTrackerWindow(html);
}
