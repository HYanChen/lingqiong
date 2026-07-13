import { defHttp } from '/@/utils/http/axios';

const base = '/lingqiong/data';

export const getDataModules = () => defHttp.get({ url: `${base}/modules` });
export const getDataRecords = (module: string, params) => defHttp.get({ url: `${base}/${module}/list`, params });
export const saveDataRecord = (module: string, params) => defHttp.post({ url: `${base}/${module}/save`, params });
export const deleteDataRecord = (module: string, id: string) =>
  defHttp.delete({ url: `${base}/${module}/delete`, params: { id } });
