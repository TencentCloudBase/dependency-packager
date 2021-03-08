# Sandpack Packager Based on TencentCloudBase

> A packager used to aggregate all relevant files from a combination of npm dependencies

## Installing

This service is based on the services of TencentCloudBase

### One Click Deploy

[![](https://main.qcloudimg.com/raw/95b6b680ef97026ae10809dbd6516117.svg)](https://console.cloud.tencent.com/tcb/env/index?action=CreateAndDeployCloudBaseProject&appUrl=https%3A%2F%2Fgithub.com%2FTencentCloudBase%2Fdependency-packager&branch=master)

### Local Deploy

```bash
npx cloudbase framework deploy -e YOUR_ENV_ID
```

## Usage

### Method

POST

### API Entry

`$YOUR_TCB_HTTP_GATEWAY_DOMAIN/packages`

### Path

Url encoded package name and version.

For example

```js
encodeURIComponent("react@16"); // react%4016
```

### Example

```bash
curl -X POST https://apps-6g88vpqqf9f70e7b-1259727701.ap-shanghai.service.tcloudbase.com/packages/react%4016

# {"url":"v2/packages/react/16.14.0.json"}

# Then you can download this json from tcb storage.
```
