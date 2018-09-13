import Log from './util/Log'
import * as jsxc from './api/v1'

export interface Settings {
   disabled?: boolean,
   xmpp?: {
      url?: string,
      node?: string,
      domain?: string,
      resource?: string,
   }
}

export type SettingsCallback = (username: string, password: string, cb?: (settings: Settings) => void) => Promise<Settings>;

export default class FormWatcher {
   private formElement: JQuery;
   private usernameElement: JQuery;
   private passwordElement: JQuery;
   private settingsCallback: SettingsCallback;

   constructor(formElement: JQuery, usernameElement: JQuery, passwordElement: JQuery, settingsCallback: SettingsCallback) {
      this.formElement = formElement;
      this.usernameElement = usernameElement;
      this.passwordElement = passwordElement;
      this.settingsCallback = settingsCallback;

      if (formElement.length !== 1) {
         throw `Found ${formElement.length} form elements. I need exactly one.`;
      }

      if (usernameElement.length !== 1) {
         throw `Found ${usernameElement.length} username elements. I need exactly one.`;
      }

      if (passwordElement.length !== 1) {
         throw `Found ${passwordElement.length} password elements. I need exactly one.`;
      }

      if (typeof settingsCallback !== 'function') {
         throw 'I need a settings callback.';
      }

      this.prepareForm();
   }

   private prepareForm() {
      let formElement = this.formElement;
      let events = formElement.data('events') || {
         submit: []
      };
      let submitEvents = [].concat(events.submit);

      formElement.data('submits', submitEvents);
      formElement.off('submit');

      formElement.submit((ev) => {
         ev.preventDefault();

         this.disableForm();

         this.onFormSubmit().then(() => {
            this.submitForm();
         }).catch((err) => {
            Log.warn(err);

            this.submitForm();
         });
      });

      Log.debug('Form watcher armed');
   }

   private async onFormSubmit() {
      let username = <string>this.usernameElement.val();
      let password = <string>this.passwordElement.val();

      let settings = await this.getSettings(username, password);

      if (typeof settings !== 'object' || settings === null) {
         throw 'No settings provided';
      }

      if (settings.disabled) {
         throw 'Duplex login disabled';
      }

      if (!settings.xmpp || !settings.xmpp.url) {
         throw 'I found no connection url';
      }

      //@TODO merge settings

      let jid;
      if (settings.xmpp.node && settings.xmpp.domain) {
         jid = settings.xmpp.node + '@' + settings.xmpp.domain;
      } else if (username.indexOf('@') > -1) {
         jid = username;
      } else if (settings.xmpp.domain) {
         jid = username + '@' + settings.xmpp.domain;
      } else {
         throw 'Could not find any jid.';
      }

      if (settings.xmpp.resource && !/@(.+)\/(.+)^/.test(jid)) {
         jid = jid + '/' + settings.xmpp.resource;
      }

      return jsxc.startAndPause(settings.xmpp.url, jid, password);
   }

   private getSettings(username: string, password: string): Promise<Settings> {
      if (typeof this.settingsCallback !== 'function') {
         return Promise.resolve({});
      }

      return new Promise((resolve) => {
         let returnPromise = this.settingsCallback(username, password, resolve);

         if (returnPromise && typeof returnPromise.then === 'function') {
            resolve(returnPromise);
         }
      });
   }

   private submitForm() {
      let formElement = this.formElement;

      formElement.off('submit');

      // Attach original events
      var submitEvents = formElement.data('submits') || [];
      submitEvents.forEach((handler) => {
         formElement.submit(handler);
      });

      this.enableForm();

      if (formElement.find('#submit').length > 0) {
         formElement.find('#submit').click();
      } else if (formElement.get(0) && typeof (<HTMLFormElement>formElement.get(0)).submit === 'function') {
         formElement.submit();
      } else if (formElement.find('[type="submit"]').length > 0) {
         formElement.find('[type="submit"]').click();
      } else {
         throw 'Could not submit login form.';
      }
   }

   private disableForm() {
      let formElement = this.formElement;

      formElement.find(':input').each(function() {
         let inputElement = $(this);

         if (inputElement.not(':disabled')) {
            inputElement.addClass('jsxc-disabled-during-login');
            inputElement.attr('disabled', 'disabled');
         }
      });
   }

   private enableForm() {
      let formElement = this.formElement;

      formElement.find('.jsxc-disabled-during-login').removeClass('jsxc-disabled-during-login').removeAttr('disabled');
   }
}