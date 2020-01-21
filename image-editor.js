/**
 * `image-editor`
 * 
 *  Accepts images from user and handles uploading/saving/optimization/deleting/previewing/rearranging
 *
 *
 *  properites:
 *
 *
 *    coll - <String> required: firestore collection path to use when saving
 *           ie. `cms/ui/programs`, 'images', `users`
 *           default -> undefined
 *
 *
 *    doc - <String> required: firestore document path to use when saving
 *           ie. `${program}`, 'home', `${uid}`
 *           default -> undefined
 *
 *
 *    field - <String> optional: firestore document object field (prop) to save the file metadata/info
 *            ie. 'backgroundImg', 'carousel', 'profileImg'
 *            default -> 'images'
 *
 *
 *    multiple - <Boolean> optional: false -> only accept one file at a time, true -> allow many files at the same time
 *               default -> false
 *
 *
 *
 *  events:
 *
 *
 *    'data-changed' - fired any time file(s) data changes
 *                     detail -> {[name]: {coll, doc, ext, field, filename, index, name, path, size, sizeStr, type, _tempUrl <, optimized, original, thumbnail>}, ...}
 *                                _tempUrl - window.URL.createObjectURL
 *                                index    - used for multiple files ordering
 *
 *
 *    'file-received' - fired after user interacts with renameFileModal and before the file upload process begins
 *                      detail -> {name, newName, size, type <, _tempUrl>}
 *                                 name     - will become 'filename' (name.ext)
 *                                 newName  - will become unique 'name' key
 *                                 _tempUrl - window.URL.createObjectURL
 *
 *  
 *    'file-uploaded' - fired after successful upload operation
 *                      detail -> {coll, doc, ext, field, filename, name, original, path, size, sizeStr, type, _tempUrl}
 *                                 original - public download url for full size original
 *
 *
 *    'file-deleted' - fired after user deletes a file
 *                     detail -> {coll, doc, ext, field, filename, index, name, path, size, sizeStr, type, _tempUrl <, optimized, original, thumbnail>}
 *
 *     
 *    'upload-cancelled' - fired if user cancels the upload process
 *                         detail -> {coll, doc, ext, field, filename, index, name, path, size, sizeStr, type, _tempUrl}          
 *
 *
 *  
 *  methods:
 *
 *
 *    getData() - returns file data {[name]: {coll, doc, ext, field, filename, index, name, path, size, sizeStr, type, _tempUrl <, optimized, original, thumbnail>}, ...}
 *              
 *
 *    delete(name) - name  -> <String> required: file name to target for delete operation
 *                            returns Promise 
 *                            resolves to {coll, doc, ext, field, filename, index, name, path, size, sizeStr, type, _tempUrl <, optimized, original, thumbnail>}
 *
 *    
 *    deleteAll() - returns Promise that resolves when deletion finishes
 *
 *
 *
 *
 * @customElement
 * @polymer
 * @demo demo/index.html
 */
import {
  SpritefulElement, 
  html
}                 from '@spriteful/spriteful-element/spriteful-element.js';
import {
  isDisplayed, 
  listen, 
  message, 
  schedule,
  warn
}                 from '@spriteful/utils/utils.js';
import services   from '@spriteful/services/services.js';
import htmlString from './image-editor.html';
import '@spriteful/app-spinner/app-spinner.js';
import '@spriteful/file-uploader/file-uploader.js';
import '@polymer/paper-button/paper-button.js';


class SpritefulImageEditor extends SpritefulElement {
  static get is() { return 'image-editor'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {
      // firebase collection
      coll: String,

      doc: String,
      // firestore document prop
      field: {
        type: String,
        value: 'images'
      },

      noSaveButton: {
        type: Boolean,
        value: false
      },
      // one file upload or multiple files
      multiple: {
        type: Boolean,
        value: false
      },
      // initialize as empty obj
      // so this.__computeSaveBtnDisabled runs
      _data: {
        type: Object,
        value: () => ({})
      },
      // ready to save (ie. every image has been optimized)
      _ready: {
        type: Boolean,
        value: false,
        computed: '__computeReady(_data)'
      },

      _tempColl: {
        type: String,
        computed: '__computeTempColl(coll)'
      }

    };
  }


  static get observers() {
    return [
      '__readyChanged(_ready)'
    ];
  }


  __computeReady(data) {
    if (!data) { return false; }
    const values = Object.values(data);
    if (!values.length) { return false; }
    return values.every(obj => 
            'optimized' in obj);
  }


  __computeTempColl(coll) {
    return `${coll}-editor-temp`;
  }


  __readyChanged(ready) {
    this.fire('image-editor-ready-changed', {value: ready});
  }


  __fileDataChanged(event) {
    this._data = event.detail;
  }


  __delete(name) {
    return services.deleteField({
      coll:   this.coll, 
      doc:    this.doc, 
      field: `${this.field}.${name}`
    });
  }
  // Fired by file-uploader anytime a file is deleted.
  // Keep live save coll in sync with 
  // '-editor-temp' coll
  __fileDeleted(event) {
    this.__delete(event.detail.name);
  }


  __save() {
    return services.set({
      coll: this.coll,
      doc:  this.doc,
      data: {
        [this.field]: this._data
      }
    });
  }


  async __saveBtnClicked() {
    try {
      await this.clicked();
      await this.save();
    }
    catch (error) { 
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async delete(name) {
    try {
      await this.$.spinner.show(`Deleting ${name} image...`);
      await this.$.uploader.delete(name);
      message(`${name} image deleted.`);
      await schedule();
    }
    catch (error) {
      console.error(error);
      await warn('Sorry, an error occured while trying to delete the image!');
    }
    finally {
      return this.$.spinner.hide();
    }
  }


  async deleteAll() {
    try {
      await this.$.spinner.show(`Deleting images...`);
      await this.$.uploader.deleteAll();
      message('Images deleted.');
      await schedule();
    }
    catch (error) {
      console.error(error);
      await warn('Sorry, an error occured while trying to delete images!');
    }
    finally {
      return this.$.spinner.hide();
    }
  }


  getData() {
    return this.$.uploader.getData();
  }


  async save() {
    try {
      await this.$.spinner.show('Saving...');
      await this.__save();
      const text = this.multiple ? 'Images' : 'Image';
      message(`${text} saved.`);
      this.fire('image-editor-save-complete');
      await schedule();
    }
    catch (error) { 
      console.error(error);
      await warn('Sorry, an unexpected error occured!');
    }
    finally {
      return this.$.spinner.hide();
    }
  }

}

window.customElements.define(SpritefulImageEditor.is, SpritefulImageEditor);
