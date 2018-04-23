import Item from './Item.js'
import EventHandler from '../Util/EventHandler.js'
import ID from '../Util/ID/ID.js'

// restructure children as if they were inserted one after another
function integrateChildren (y, start) {
  let right
  do {
    right = start._right
    start._right = null
    start._right_origin = null
    start._origin = start._left
    start._integrate(y)
    start = right
  } while (right !== null)
}

export function getListItemIDByPosition (type, i) {
  let pos = 0
  let n = type._start
  while (n !== null) {
    if (!n._deleted) {
      if (pos <= i && i < pos + n._length) {
        const id = n._id
        return new ID(id.user, id.clock + i - pos)
      }
      pos++
    }
    n = n._right
  }
}

function gcChildren (y, item) {
  while (item !== null) {
    item._delete(y, false, true)
    item._gc(y)
    item = item._right
  }
}

/**
 * Abstract Yjs Type class
 */
export default class Type extends Item {
  constructor () {
    super()
    this._map = new Map()
    this._start = null
    this._y = null
    this._eventHandler = new EventHandler()
    this._deepEventHandler = new EventHandler()
  }

  /**
   * Compute the path from this type to the specified target.
   *
   * @example
   * It should be accessible via `this.get(result[0]).get(result[1])..`
   * const path = type.getPathTo(child)
   * // assuming `type instanceof YArray`
   * console.log(path) // might look like => [2, 'key1']
   * child === type.get(path[0]).get(path[1])
   *
   * @param {YType} type Type target
   * @return {Array<string>} Path to the target
   */
  getPathTo (type) {
    if (type === this) {
      return []
    }
    const path = []
    const y = this._y
    while (type !== this && type !== y) {
      let parent = type._parent
      if (type._parentSub !== null) {
        path.unshift(type._parentSub)
      } else {
        // parent is array-ish
        for (let [i, child] of parent) {
          if (child === type) {
            path.unshift(i)
            break
          }
        }
      }
      type = parent
    }
    if (type !== this) {
      throw new Error('The type is not a child of this node')
    }
    return path
  }

  /**
   * @private
   * Call event listeners with an event. This will also add an event to all
   * parents (for `.observeDeep` handlers).
   */
  _callEventHandler (transaction, event) {
    const changedParentTypes = transaction.changedParentTypes
    this._eventHandler.callEventListeners(transaction, event)
    let type = this
    while (type !== this._y) {
      let events = changedParentTypes.get(type)
      if (events === undefined) {
        events = []
        changedParentTypes.set(type, events)
      }
      events.push(event)
      type = type._parent
    }
  }

  /**
   * @private
   * Helper method to transact if the y instance is available.
   *
   * TODO: Currently event handlers are not thrown when a type is not registered
   *       with a Yjs instance.
   */
  _transact (f) {
    const y = this._y
    if (y !== null) {
      y.transact(f)
    } else {
      f(y)
    }
  }

  /**
   * Observe all events that are created on this type.
   *
   * @param {Function} f Observer function
   */
  observe (f) {
    this._eventHandler.addEventListener(f)
  }

  /**
   * Observe all events that are created by this type and its children.
   *
   * @param {Function} f Observer function
   */
  observeDeep (f) {
    this._deepEventHandler.addEventListener(f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {Function} f Observer function
   */
  unobserve (f) {
    this._eventHandler.removeEventListener(f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {Function} f Observer function
   */
  unobserveDeep (f) {
    this._deepEventHandler.removeEventListener(f)
  }

  /**
   * @private
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   */
  _integrate (y) {
    super._integrate(y)
    this._y = y
    // when integrating children we must make sure to
    // integrate start
    const start = this._start
    if (start !== null) {
      this._start = null
      integrateChildren(y, start)
    }
    // integrate map children
    const map = this._map
    this._map = new Map()
    for (let t of map.values()) {
      // TODO make sure that right elements are deleted!
      integrateChildren(y, t)
    }
  }

  _gcChildren (y) {
    gcChildren(y, this._start)
    this._start = null
    this._map.forEach(item => {
      gcChildren(y, item)
    })
    this._map = new Map()
  }

  _gc (y) {
    this._gcChildren(y)
    super._gc(y)
  }

  /**
   * @private
   * Mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   */
  _delete (y, createDelete, gcChildren) {
    if (gcChildren === undefined) {
      gcChildren = y._hasUndoManager === false
    }
    super._delete(y, createDelete, gcChildren)
    y._transaction.changedTypes.delete(this)
    // delete map types
    for (let value of this._map.values()) {
      if (value instanceof Item && !value._deleted) {
        value._delete(y, false, gcChildren)
      }
    }
    // delete array types
    let t = this._start
    while (t !== null) {
      if (!t._deleted) {
        t._delete(y, false, gcChildren)
      }
      t = t._right
    }
    if (gcChildren) {
      this._gcChildren(y)
    }
  }
}
