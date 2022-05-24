# [songbook.chalmers.it](https://songbook.chalmers.it)

The digital songbook of the software engineering student division with all the songs you've come to love.

## Development

The easiest way to get started is docker compose and setting the gamma secret and client in docker-compose.yml.

### Docker-compose
`docker-compose up --build`

`docker-compose.yml` sets up the following dependencies:

* Frontend with hot reloading support.
* Postgres database for the backend.
* The frontend, backend, a database, and a Redis instance for [Gamma](https://github.com/cthit/gamma).

### Running backend seperately
Comment out from depens_on: songbook-backend all the way down to songbook_db.

For the backend to connect to the other dependencies, a proxy has to be set up. 
This value, `proxy` is specified in `frontend/package.json` and should have the value of the Gateway address for the frontend's docker container.
It can be found by following the steps below.

* Run `docker-compose up`.
* When all the containers are active, execute `docker ps`.
* Copy a Container ID for a container in the Songbook application. 
  There should be a several containers listed in table, any of which can be used. 
* Execute `docker inspect <Contianer ID> | grep "Gateway":`.
* The address/es found is the value of your `proxy`.

### Adding mocking data

In `backend/src/App.py` the function `setup_db(bool)` is used to reset, create and populate the database with mocking data.
It is controlled by the boolean passed to it.

### Adding or updating dependencies

Docker can be unforgiving when trying to update dependencies.

* Start with updating your dependencies in one of the package.json, either the one for the frontend or the one for the backend.
* Run `yarn install`.
* Run `docker-compose rm`. This will remove your volumes and any previously saved data.
* Run `docker-compose build --force-rm --no-cache songbook_songbook-frontend_1`

After that, you can just run `docker-compose up` to get started again.

## Deployment
What's needed to run songbook in production is:

- Frontend
- Backend
- PostgreSQL database
- Reverse proxy (to run the frontend and backend from the same port)

### **Database migration**
Right now there's no migration script installed on songbook.chalmers.it.
You'll have to do it manually. Just don't forget to make a backup before starting.
In the future, there should be SQL files for migration in `/database/migration`.

### **Environment variables**

All variables are set by providing them to the docker containers, either directly or through docker-compose. 

#### **Path to mock data**
The sourceroot in the backend differ between the IDE and docker so the following variable is necessary if a reset has to be done.  
- `INIT_DATA_PATH`:
  - Production should use: `src/setup/md/`
  - Default, since the module `src` should be marked as Source in your IDE: `setup/md/`

#### **Database properties**
Environment variables for the backend to connect to a PostgreSQL database.
- `SONGBOOK_POSTGRES_HOST`
- `SONGBOOK_POSTGRES_PORT`
- `SONGBOOK_POSTGRES_USER`
- `SONGBOOK_POSTGRES_DB`
- `SONGBOOK_POSTGRES_PASSWORD`: 

#### **Gamma properties**
songbook.chalmers.it is designed with usage with Gamma.
Note that the defaults are matched with the values in `docker-compose.yml` for ease to start developing locally.

##### ***Authority***
Songbook checks for the Authority specified in the following variables.
`GAMMA_ADMIN_AUTHORITY` is passed to the backend, and the other is passed to the frontend as you might have guessed.
- `GAMMA_ADMIN_AUTHORITY`: Default is `songbook`.
- `REACT_APP_GAMMA_ADMIN_AUTHORITY`: Default is `songbook`.

##### ***The rest of 'em***
These variables should all be applied to the frontend.
- `REACT_APP_GAMMA_FRONTEND_URL`:
  - Should be: https://gamma.chalmers.it
  - Development: http://localhost:3000"
- `REACT_APP_GAMMA_BACKEND_URL`:
  - Should be: `https://gamma.chalmers.it/api`
  - Development: `http://localhost:8081/api`


These variables should all be applied to the backend.
- `GAMMA_SECRET`: Default `secret`.
- `GAMMA_CLIENT_ID`, `GAMMA_CLIENT_SECRET`: Id and secret of the client from Gamma. Default is `id`/`secret`.
- `GAMMA_AUTHORIZATION_URI`:
  - Should be the full URL, probably: `https://songbook.chalmers.it/api/oauth/authorize`.
  - Default: `http://localhost:8081/api/oauth/authorize`.
- `GAMMA_REDIRECT_URI`:
  - Should as well be the full URL, probably: `https://gamma.chalmers.it/api/auth/account/callback`.
  - Default `http://localhost:3001/auth/account/callback`.
- `GAMMA_ME_URI`: 
  - Yep, full URL, probably: `https://gamma.chalmers.it/api/users/me`
  - Default `http://localhost:8081/api/users/me`.
- `GAMMA_TOKEN_URI`:
  - Same old story here, probably: `https://gamma.chalmers.it/api/oauth/token`
  - Default `http://localhost:8081/api/oauth/token`.

