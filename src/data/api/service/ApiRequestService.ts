import {StorageAccessService} from "../../storage/StorageAccessService.js";

export class ApiRequestService
{
	private _onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null = null;
	private _method: ApiRequestMethodEnum = ApiRequestMethodEnum.GET;
	private _async: boolean = true;
	private _params: Array<ApiParameter> = [];


	public get_onreadystatechange(): ((this: XMLHttpRequest, ev: Event) => any) | null
	{
		return this._onreadystatechange;
	}

	public set_onreadystatechange(value: ((this: XMLHttpRequest, ev: Event) => any) | null)
	{
		this._onreadystatechange = value;
	}

	public get_method(): ApiRequestMethodEnum
	{
		return this._method;
	}

	public set_method(value: ApiRequestMethodEnum)
	{
		this._method = value;
	}

	public get_async(): boolean
	{
		return this._async;
	}

	public set_async(async: boolean): void
	{
		this._async = async;
	}

	public add_param(key: string, value?: string): void
	{
		if (!value)
		{
			value = null;
		}
		this._params.push({[key]: value})
	}

	public async send(): Promise<void>
	{
		const httpResponse = new XMLHttpRequest();    //Make a new object to accept return from server
		const url_base = (await StorageAccessService.get_pi_hole_settings()).pi_uri_base;
		const api_key = (await StorageAccessService.get_pi_hole_settings()).api_key;

		let url: string = url_base + "/api.php?auth=" + api_key;

		for (let i = 0; i < this._params.length; i++)
		{
			const params: ApiParameter = this._params[i];
			if (params)
			{
				const key: string = Object.keys(params)[0];
				const value: string = Object.keys(params).map(key => params[key])[0];


				url += "&" + key + (value ? '=' + value : '');
			}
		}

		if (this.get_onreadystatechange())
		{
			httpResponse.onreadystatechange = this.get_onreadystatechange()
		}

		httpResponse.open(this.get_method(), url, this.get_async());
		httpResponse.send();
	}
}

interface ApiParameter
{
	[key: string]: string;
}

export enum ApiRequestMethodEnum
{
	GET = 'Get',
	POST = 'Post'
}