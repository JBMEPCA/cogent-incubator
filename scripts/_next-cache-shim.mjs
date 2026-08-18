// Stands in for next/cache outside a Next server. unstable_cache returns a
// function that just runs the work — a verification script should read live
// numbers rather than a cached blob. See scripts/_next-resolve.mjs.
export const unstable_cache = (fn) => fn;
export const revalidatePath = () => {};
export const revalidateTag = () => {};
