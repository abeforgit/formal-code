/**
 * Runs some magic to get the real functor in our hands and to bind the right context.
 */
function getRealFunctor(functor) {
  const realFunctor = typeof functor === "string"
    ? this[functor]
    : functor;

  if (typeof realFunctor !== "function") {
    throw `Incorrectly applied @pre, precondition function could not be found (${functor})`;
  }

  return realFunctor.bind(this);
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
      if (!realFunctor.apply(this, args))
        throw getReason(functor, reason);
      else
        return originalResult;
    };

    return descriptor;
  };
}

export { pre, post };
