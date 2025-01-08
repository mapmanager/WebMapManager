# WebMapManager
A web version of PyMapManager.

**Note:** This project is still in active development and is not production-ready.

## Setup

* Initialize submodules:
```bash
  git submodule init
  git submodule update
```
* Install Node.js(https://nodejs.org/en)
* Install Python 3.11+
* Install JS dependencies:
```bash
  yarn install
```

## Build
* Build the static application:
```bash
  yarn build
```
* Upload the `/build/` directory to `/WebMapManager/` to your static file server.
  * By default, the application is served from a `/WebMapManager/`. To serve the application another directory:
    * Update `homepage` in `packages.json`to the directory of your choice:
      ```json
        {
        "homepage": "/WebMapManager/",
        }
      ```

## Running WebMapManager

* Run the server:
```bash
  yarn start
```
* Open [http://localhost:3000](http://localhost:3000) to view it in the browser (Tested on Google Chrome).
