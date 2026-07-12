import { defHttp } from '/@/utils/http/axios';

const bridge = '/lingqiong/bridge';

export const getSiteContent = () => defHttp.get({ url: `${bridge}/admin/content` });
export const saveSiteContent = (params) => defHttp.put({ url: `${bridge}/admin/content`, params });

export const getLoginSettings = () => defHttp.get({ url: `${bridge}/admin/login-settings` });
export const saveLoginSettings = (params) => defHttp.put({ url: `${bridge}/admin/login-settings`, params });

export const getModelApis = () => defHttp.get({ url: `${bridge}/admin/model-apis` });
export const saveModelApi = (params) => defHttp.post({ url: `${bridge}/admin/model-apis`, params });
export const deleteModelApi = (id: string) => defHttp.delete({ url: `${bridge}/admin/model-apis`, data: { id } });

export const getProjectTypes = () => defHttp.get({ url: `${bridge}/admin/project-types` });
export const saveProjectType = (params) => defHttp.post({ url: `${bridge}/admin/project-types`, params });
export const deleteProjectType = (id: string) => defHttp.delete({ url: `${bridge}/admin/project-types`, data: { id } });

export const uploadSiteImage = (file: File, onUploadProgress?: (event: ProgressEvent) => void) =>
  defHttp.uploadFile(
    { url: '/lingqiong/media/upload', onUploadProgress },
    { file, filename: file.name },
  );
