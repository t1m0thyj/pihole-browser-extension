import {PiHoleApiStatus, PiHoleApiStatusEnum} from "../models/pihole/PiHoleApiStatus";
import {ApiJsonErrorMessages} from "../errors/ApiErrorMessages";
import {ApiListMode, PiHoleListStatus} from "../models/pihole/PiHoleListStatus";
import {PiHoleSettingsStorage, StorageService} from "../../browser/StorageService";
import {PiHoleVersions} from "../models/pihole/PiHoleVersions";
import {ApiRequestMethodEnum, PiHoleApiRequest} from "./PiHoleApiRequest";

/**
 * @deprecated Use Promise based api-access
 * @see PiHoleApiService
 */
export class LegacyPiHoleApiService {
    /**
     * Returns an array of PiHoleVersions for each pihole
     */
    public static async getPiHoleVersions(): Promise<PiHoleVersions[]> {
        const storage = (await StorageService.getPiHoleSettingsArray());
        if (typeof storage === "undefined") {
            return [];
        }
        let promise_array = [];
        for (const pi_hole_setting of storage) {
            promise_array.push(new Promise<PiHoleVersions>(resolve => this.piHoleVersionPromiseFunction(pi_hole_setting, resolve)));
        }

        return await Promise.all<PiHoleVersions>(promise_array);
    }

    /**
     * Function to remove a domain from a list
     */
    public static async subDomainFromList(domain: string, list: ApiListMode): Promise<void> {
        const request_promises = [];
        const storage = (await StorageService.getPiHoleSettingsArray());
        if (typeof storage === "undefined") {
            return;
        }
        for (const pi_hole of storage) {
            request_promises.push(new Promise<void>(resolve => this.subDomainFromListPromiseFunction(pi_hole, list, domain, resolve)));
        }

        await Promise.all<void>(request_promises);
    }

    /**
     * Sends a request to list a domain on all pi-holes
     */
    public static async listDomain(domain: string, mode: ApiListMode): Promise<PiHoleListStatus[]> {
        const request_promises = [];
        const storage = (await StorageService.getPiHoleSettingsArray());
        if (typeof storage === "undefined") {
            return [];
        }
        for (const pi_hole of storage) {
            request_promises.push(new Promise<PiHoleListStatus>(resolve => this.listDomainPromiseFunction(pi_hole, mode, domain, resolve)));
        }

        return await Promise.all<PiHoleListStatus>(request_promises);
    }

    /**
     * Function to refresh the current PiHoleStatus
     */
    public static async refreshPiHoleStatus(successCallback: (data: PiHoleApiStatus) => void): Promise<void> {
        const request_promises = [];
        const storage = (await StorageService.getPiHoleSettingsArray());
        if (typeof storage === "undefined") {
            return;
        }
        for (const pi_hole of storage) {
            const promise_function = (resolve: (value?: any) => void) => this.refreshPiHoleStatusPromiseFunction(pi_hole, resolve);

            const pi_hole_promise: Promise<PiHoleApiStatus> = new Promise(promise_function);
            request_promises.push(pi_hole_promise);
        }

        const results: PiHoleApiStatus[] = await Promise.all<PiHoleApiStatus>(request_promises);

        for (const result of results) {
            // If any pihole is offline or has an error we use its status
            if (result.status === PiHoleApiStatusEnum.error || result.status === PiHoleApiStatusEnum.disabled) {
                successCallback(result);
                return;
            }
        }
        successCallback({status: PiHoleApiStatusEnum.enabled});

    }

    /**
     * Promise function for PiHoleApiService::get_pi_hole_version
     */
    private static piHoleVersionPromiseFunction(pi_hole_settings: PiHoleSettingsStorage, resolve: (value: PiHoleVersions) => void): void {
        const pi_uri_base = pi_hole_settings.pi_uri_base;
        const api_key = pi_hole_settings.api_key;
        if (typeof pi_uri_base === "undefined" || typeof api_key === "undefined") {
            return;
        }

        const request = new PiHoleApiRequest(pi_uri_base, api_key);

        request.add_get_param('versions');

        request.onreadystatechange = function (this: XMLHttpRequest) {
            if (this.readyState === 4 && this.status === 200) {
                let versions: PiHoleVersions = {
                    FTL_latest: 0,
                    core_latest: 0,
                    web_latest: 0,
                    FTL_current: 0,
                    core_current: 0,
                    web_current: 0,
                    FTL_update: false,
                    web_update: false,
                    core_update: false
                };

                try {
                    const data = JSON.parse(this.response);
                    Object.entries(data).forEach(([key, value]) => {
                        if (key in versions) {
                            if (typeof value === "boolean") {
                                //@ts-ignore
                                versions[key] = value;
                                return;
                            }
                            let version: number | string = String(value).replace('v', '');
                            if (version === 'Dev') {
                                version = -1;
                            } else {
                                version = Number(version.charAt(0));
                            }
                            //@ts-ignore
                            versions[key] = version;
                        }
                    });
                    resolve(versions);

                } catch (e) {
                    console.log(e);
                }
            }
        }
        request.send().then();
    }

    /**
     * Removes a domain from a list
     */
    private static subDomainFromListPromiseFunction(pi_hole_settings: PiHoleSettingsStorage, mode: ApiListMode, domain: string, resolve: () => void): void {
        const pi_uri_base = pi_hole_settings.pi_uri_base;
        const api_key = pi_hole_settings.api_key;
        if (typeof pi_uri_base === "undefined" || typeof api_key === "undefined") {
            return;
        }

        const api_request = new PiHoleApiRequest(pi_uri_base, api_key);

        api_request.method = ApiRequestMethodEnum.GET;
        api_request.add_get_param('list', mode);
        api_request.add_get_param('sub', domain);

        api_request.onreadystatechange = function (this: XMLHttpRequest) {
            if (this.readyState === 4 && this.status === 200) {
                resolve();
            }
            // Legacy for PiHole v5.0 or less
            if (this.readyState === 4 && this.status === 500) {
                console.warn("You don't use PiHole v5.1+ or higher. Please consider upgrading!");
                resolve();
            }
        }

        api_request.send().then();
    }

    /**
     * Promise function for PiHoleApiService::list_domain
     */
    private static listDomainPromiseFunction(pi_hole_settings: PiHoleSettingsStorage, mode: ApiListMode, domain: string, resolve: (value: PiHoleListStatus) => void): void {
        const pi_uri_base = pi_hole_settings.pi_uri_base;
        const api_key = pi_hole_settings.api_key;
        if (typeof pi_uri_base === "undefined" || typeof api_key === "undefined") {
            resolve({message: '', success: false});
            return;
        }

        const api_request = new PiHoleApiRequest(pi_uri_base, api_key);

        api_request.method = ApiRequestMethodEnum.POST;
        api_request.add_get_param('list', mode);
        api_request.add_get_param('add', domain);
        api_request.add_post_param('comment', 'Added via PiHole Remote Extension');

        api_request.onreadystatechange = function (this: XMLHttpRequest) {
            if (this.readyState === 4 && this.status === 200) {
                let response: PiHoleListStatus;

                try {
                    response = JSON.parse(this.response);
                } catch (e) {
                    console.log(e);
                    let string_response = this.response;
                    // Legacy Fallback for v5.0 or less
                    if (string_response.includes('skipped') || string_response.includes('Not adding')) {
                        response = {message: 'Not adding', success: true};
                    } else if (string_response.includes('added') || string_response.includes('Added')) {
                        response = {message: 'Added', success: true};
                    } else {
                        response = {message: 'failed', success: false};
                    }
                }

                resolve(response);
            }
        }

        api_request.send().then();
    }

    /**
     * Promise function for PiHoleApiService::refresh_pi_hole_status
     */
    private static refreshPiHoleStatusPromiseFunction(pi_hole_settings: PiHoleSettingsStorage, resolve: (value: PiHoleApiStatus) => void): void {
        const pi_uri_base = pi_hole_settings.pi_uri_base;
        const api_key = pi_hole_settings.api_key;
        if (typeof pi_uri_base === "undefined" || typeof api_key === "undefined") {
            resolve({status: PiHoleApiStatusEnum.error});
            return;
        }

        const api_request: PiHoleApiRequest = new PiHoleApiRequest(pi_uri_base, api_key);

        const onreadystatechange = function (this: XMLHttpRequest) {
            if (this.readyState === 4 && this.status === 200) {
                // Action to be performed when the document is read;
                try {
                    let data: PiHoleApiStatus = JSON.parse(this.response);
                    resolve(data);
                } catch (e) {
                    console.warn(ApiJsonErrorMessages.invalid);
                    const error: PiHoleApiStatus = {status: PiHoleApiStatusEnum.error};
                    resolve(error);
                }
            } else if (this.status !== 200 && this.status !== 0) {
                const error: PiHoleApiStatus = {status: PiHoleApiStatusEnum.error};
                resolve(error);
            }
        };

        api_request.add_get_param('status');
        api_request.onreadystatechange = onreadystatechange;

        api_request.send().then();
    }
}