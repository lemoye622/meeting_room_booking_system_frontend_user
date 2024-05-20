import axios, { AxiosRequestConfig } from "axios";
import { RegisterUser } from "../page/register/Register";
import { UpdatePassword } from "../page/update_password/UpdatePassword";
import { UserInfo } from "../page/update_info/UpdateInfo";
import { message } from "antd";

interface PendingTask {
    config: AxiosRequestConfig,
    resolve: Function
}

// 使用 refreshing 的标记和 task 队列的目的是为了实现并发请求只刷新一次
let refreshing = false;
const queue: Array<PendingTask> = [];

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3005/',
    timeout: 3000
});

axiosInstance.interceptors.request.use(function (config) {
    const accessToken = localStorage.getItem('access_token');

    if(accessToken) {
        config.headers.authorization = 'Bearer ' + accessToken;
    }
    return config;
})

axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        // 这里是考虑到请求没有发送成功的情况
        // 这种情况下，错误对象是没有 response 属性的
        if (!error.response) {
            return Promise.reject(error);
        }

        let { data, config } = error.response;

        if (refreshing) {
            return new Promise((resolve) => {
                queue.push({
                    config,
                    resolve
                });
            });
        }

        // 如果返回的错误是 401 就刷新 token，这里要排除掉刷新的 url，刷新失败不继续刷新
        // 如果刷新接口返回的是 200，就用新 token 调用之前的接口
        // 如果刷新接口返回的是 401，那就提示错误信息，跳转到登录页
        if (data.code === 401 && !config.url.includes('/user/refresh')) {
            refreshing = true;
            
            const res = await refreshToken();
            refreshing = false;

            if (res.status === 200) {
                queue.forEach(({config, resolve}) => {
                    resolve(axiosInstance(config));
                });

                return axiosInstance(config);
            } else {
                message.error(res.data);
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            }
        } else {
            return error.response;
        }
    }
)

export async function login(username: string, password: string) {
    return await axiosInstance.post('user/login', {
        username,
        password
    })
}

export async function register(registerUser: RegisterUser) {
    return await axiosInstance.post('/user/register', registerUser);
}

async function refreshToken() {
    const res = await axiosInstance.get('/user/refresh', {
        params: {
          refresh_token: localStorage.getItem('refresh_token')
        }
    });
    localStorage.setItem('access_token', res.data.access_token || '');
    localStorage.setItem('refresh_token', res.data.refresh_token || '');
    return res;
}

export async function registerCaptcha(address: string) {
    return await axiosInstance.get('/user/register-captcha', {
        params: {
            address
        }
    })
}

export async function updatePasswordCaptcha(address: string) {
    return await axiosInstance.get('/user/update_password/captcha', {
        params: {
            address
        }
    })
}

export async function updatePassword(data: UpdatePassword) {
    return await axiosInstance.post('/user/update_password', data);
}

export async function getUserInfo() {
    return await axiosInstance.get('/user/info');
}

export async function updateInfo(data: UserInfo) {
    return await axiosInstance.post('/user/update', data);
}

export async function updateUserInfoCaptcha() {
    return await axiosInstance.get('/user/update/captcha');
}