/**
 * Arrow functions can't be rebound to a new context.  We want to be
 * able to do this to make the decorators more obvious in their use for
 * simple statements.
 *
 * The rebinding mechanism proposed here will not be easily understood
 * by static analysis tools.  Yet it's the closest we have to creating
 * something easy to understand.
 */
function bindable(functor) {
  if( !functor.prototype ) {
    // it's an arrow-function and we will do trickery
    // https://stackoverflow.com/questions/33308121/can-you-bind-this-in-an-arrow-function
    const bindableFunction = function () {
      const redefinedFunction = eval(functor.toString());
      return redefinedFunction(...arguments);
    };
    bindableFunction.toString = () => functor.toString();
    return bindableFunction;
  } else {
    return functor;
  }
}

/**
 * Runs some magic to get a real functor which can be bound to the
 * necessary context.
 */
function getRealFunctor(functor) {
  const realFunctor = typeof functor === "string"
    ? this[functor]
    : functor;

  if (typeof realFunctor !== "function") {
    throw `Incorrectly applied @pre, precondition function could not be found (${functor})`;
  }

  return bindable(realFunctor);
}

/**
 * Returns a reason which we can yield to users.
 */
function getReason(functor, reason) {
  if (reason !== undefined)
    return reason;
  else
    return functor.toString();
}

/**
 * Applies a pre-condition.
 *
 * The functor can be:
 * - a string: name of a method on this instance.
 * - a function: function which will yield true/false when called with
 *     the arguments of the decorated function.
 *
 * An error is thrown if the pre-condition does not match.
 */
function pre(functor, reason) {
  return function(target, name, descriptor) {
    const original = descriptor.value;

    descriptor.value = function(...args) {
      const realFunctor = getRealFunctor.call(this, functor);

      if (!realFunctor.apply(this, args))
        throw getReason(functor, reason);
      else
        return original.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Applies a post-condition.
 *
 * - a string: name of a method on this instance.
 * - a function: function which will yield true/false when called with
 *     the arguments of the decorated function.
 *
 * An error is thrown if the post-condition does not match.
 */
function post(functor, reason) {
  return function(target, name, descriptor) {
    const original = descriptor.value;

    descriptor.value = function(...args) {
      const realFunctor = getRealFunctor.call(this, functor);
      const originalResult = original.apply(this, args);
      if (!realFunctor.apply(this, [originalResult, ...args]))
        throw getReason(functor, reason);
      else
        return originalResult;
    };

    return descriptor;
  };
}

export { pre, post };
