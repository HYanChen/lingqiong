import { defHttp } from '/@/utils/http/axios';

const bridge = '/lingqiong/bridge';
const parseBridge = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

export const getSiteContent = async () => parseBridge(await defHttp.get({ url: `${bridge}/admin/content` }));
export const saveSiteContent = async (params) => parseBridge(await defHttp.put({ url: `${bridge}/admin/content`, params }));

export const getLoginSettings = async () => parseBridge(await defHttp.get({ url: `${bridge}/admin/login-settings` }));
export const saveLoginSettings = async (params) => parseBridge(await defHttp.put({ url: `${bridge}/admin/login-settings`, params }));

export const getModelApis = async () => parseBridge(await defHttp.get({ url: `${bridge}/admin/model-apis` }));
export const saveModelApi = async (params) => parseBridge(await defHttp.post({ url: `${bridge}/admin/model-apis`, params }));
export const deleteModelApi = async (id: string) => parseBridge(await defHttp.delete({ url: `${bridge}/admin/model-apis`, data: { id } }));

export const getProjectTypes = async () => parseBridge(await defHttp.get({ url: `${bridge}/admin/project-types` }));
export const saveProjectType = async (params) => parseBridge(await defHttp.post({ url: `${bridge}/admin/project-types`, params }));
export const deleteProjectType = async (id: string) => parseBridge(await defHttp.delete({ url: `${bridge}/admin/project-types`, data: { id } }));

export const uploadSiteImage = (file: File, onUploadProgress?: (event: ProgressEvent) => void) =>
  defHttp.uploadFile(
    { url: '/lingqiong/media/upload', onUploadProgress },
    { file, filename: file.name },
  );
