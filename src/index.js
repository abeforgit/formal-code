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
  if (!functor.prototype) {
    // it's an arrow-function and we will do trickery
    // https://stackoverflow.com/questions/33308121/can-you-bind-this-in-an-arrow-function
    const bindableFunction = function() {
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
 * Determines if a response seems to be async, in which case we should
 * treat it differently.
 *
 * Due to transpiling, we have to check for duck typing.
 *
 * The options argument may force async to be true or false, in which
 * case we follow that, otherwise we try to detect if this is a promise
 * by checking for a .then, .catch and .finally on the response object.
 */
function isAsync(response, reason) {
  if (typeof reason === "object" && reason.async !== undefined) {
    return reason.async;
  } else if (typeof response === "object") {
    return typeof response.then === "function"
      && typeof response.catch === "function"
      && typeof response.finally === "function";
  } else {
    return false;
  }
}

/**
 * Returns a reason which we can yield to users.
 *
 * Reason might be an object with a "reason" property, in which case we
 * yield that.  That allows us to treat the last argument as something
 * that can yield options.
 */
function getReason(functor, reason) {
  let message;
  if (reason === undefined)
    message = functor.toString();
  else if (typeof reason === "string")
    message = reason;
  else
    message = reason.reason;

  return message;
}

/**
 * Constructs an error object for a known failure and reports it to the
 * console.
 *
 * @param {string} message The message to emit.
 * @param {[any]} args Arguments given to the validation function.
 * @return {Error} Object which can be thrown.
 */
function constructError(message, args) {
  console.trace({ message, args });
  return new Error({ message, args });
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
  return function(_target, _name, descriptor) {
    const original = descriptor.value;

    descriptor.value = function(...args) {
      const realFunctor = getRealFunctor.call(this, functor);

      if (!realFunctor.apply(this, args))
        throw constructError(getReason(functor, reason), args);
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
  return function(_target, _name, descriptor) {
    const original = descriptor.value;

    descriptor.value = function(...args) {
      const realFunctor = getRealFunctor.call(this, functor);
      const originalResult = original.apply(this, args);

      if (isAsync(originalResult, reason)) {
        return new Promise((acc, rej) => {
          originalResult
            .then((promiseResult) => {
              if (realFunctor.apply(this, [promiseResult, ...args]))
                acc(promiseResult);
              else
                rej(constructError(getReason(functor, reason), [promiseResult, ...args]));
            })
            .catch((promiseFailure) => rej(promiseFailure));
        });
      } else {
        if (!realFunctor.apply(this, [originalResult, ...args]))
          throw constructError(getReason(functor, reason), [originalResult, ...args]);
        else
          return originalResult;
      }
    };

    return descriptor;
  };
}

export { pre, post };
