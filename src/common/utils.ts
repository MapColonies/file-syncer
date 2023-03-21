export const sleep = async (ms: number): Promise<unknown> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};
