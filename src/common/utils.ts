export const sleep = async (ms: number): Promise<unknown> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const changeModelName = (oldName: string, newName: string): string => { 
  const nameSplitted = oldName.split('/');
  nameSplitted[0] = newName;
  return nameSplitted.join('/');
}