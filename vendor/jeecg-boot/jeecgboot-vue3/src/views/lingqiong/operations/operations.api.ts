import { defHttp } from '/@/utils/http/axios';

export const getSummary = () => defHttp.get({ url: '/lingqiong/dashboard/summary' });
export const getProjects = (params) => defHttp.get({ url: '/lingqiong/projects/list', params });
export const updateProject = (params) => defHttp.put({ url: '/lingqiong/projects/edit', params });
export const getUsers = (params) => defHttp.get({ url: '/lingqiong/users/list', params });
export const updateUser = (params) => defHttp.put({ url: '/lingqiong/users/edit', params });
export const getJobs = (params) => defHttp.get({ url: '/lingqiong/jobs/list', params });
export const retryJob = (id: string) => defHttp.put({ url: `/lingqiong/jobs/${id}/retry` });
export const cancelJob = (id: string) => defHttp.put({ url: `/lingqiong/jobs/${id}/cancel` });
