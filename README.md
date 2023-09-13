# File Syncer Service
The File Syncer service is responsible for copying the model from a source location to a destination location, which can be either NFS or S3. It runs on a constant interval and fetches pending tasks from the Job Manager database. Once a new pending task is found, the service initiates the synchronization process by copying the associated files to the appropriate destination (either NFS or S3) based on the configuration.

## Functionality
The File Syncer service performs the following steps:

Interval Execution: The service runs on a constant interval, which can be controlled using the 'intervalMs' parameter in the configuration. This ensures that the synchronization process is regularly executed.

Pending Task Retrieval: In each interval, the service fetches pending tasks from the Job Manager database. These tasks represent the files that need to be synchronized.

File Sync: For each pending task, the service copies the corresponding files from the source location to the destination location. The source and destination can be configured to be either NFS or S3.

Task Pool Size: The File Syncer service has a task pool that determines the number of tasks it can fetch and process in each interval. The size of the task pool is determined by the 'taskPoolSize' parameter in the configuration.

## Retry mechanism: 
The file syncer service incorporates a robust retry mechanism to ensure the successful completion of tasks, even when faced with potential external issues. This mechanism is designed to handle cases where the NFS/S3 providers experience temporary busy states, preventing task completion. The retry mechanism consists of two layers of retries, each serving a specific purpose. 
#### Major Retry Layer - `maxAttempts`
The major retry layer is known as `maxAttempts`, for the `attempts` column in the task. This parameter represents the total number of attempts made to accomplish a task. Each time the task encounters an obstacle, the `attempts` count is incremented. This allows the service to track the number of times the task has been attempted, ensuring that the system does not give up too soon. 
#### Minor Retry Layer - `maxRetries`
The minor retry layer, called `maxRetries`, operates within the service itself. It facilitates retries of the file syncing process within the service before reflecting them in the `attempts` count. This layer acknowledges that the NFS/S3 providers might experience temporary busy periods, which should not lead to task failure. Instead of immediately marking a task as failed due to provider congestion, the service tries syncing the files again for a number of times.
#### Why the Retry Mechanism?

The need for a retry mechanism arises from the unpredictable nature of external dependencies like NFS and S3. These providers may occasionally become overloaded or encounter transient issues, resulting in failed attempts to sync files. The retry mechanism prevents such instances from affecting task success rates. By incorporating a multi-layered approach to retries, the file syncer service enhances its reliability and resilience, ensuring that tasks have a higher likelihood of successful completion even in the face of external challenges.

## Dependencies
The File Syncer service has the following dependencies:

Job Manager: The File Syncer service relies on the Job Manager to fetch pending tasks from the database.
Heartbeat Manager: The File Syncer service depends on the Heartbeat Manager to log the last heartbeat for workers assigned to specific tasks. The Heartbeat Manager is responsible for tracking the activity status of workers and ensuring that tasks remain active.

## Configuration
The File Syncer service can be configured using the following parameters:

intervalMs: Specifies the time interval, in milliseconds, at which the service runs and fetches pending tasks.
taskPoolSize: Determines the maximum number of tasks that can be fetched and processed in each interval.
These configuration parameters allow users to customize the behavior of the File Syncer service based on their specific requirements.

## Usage
To use the File Syncer service, you need to configure the source and destination locations, as well as set the appropriate parameters in the configuration file. The service will automatically run on the specified interval and synchronize the files between the source and destination according to pending tasks.

Ensure that the Job Manager service is running and properly configured, as the File Syncer service relies on it to fetch the pending tasks.

## Installation

Install deps with npm

```bash
npm install
```
### Install Git Hooks
```bash
npx husky install
```

## Run Locally

Clone the project

```bash

git clone https://link-to-project

```

Go to the project directory

```bash

cd my-project

```

Install dependencies

```bash

npm install

```

Start the script

```bash

npm run start -- [parameter1] [parameter 2] [...]

```

## Running Tests

To run tests, run the following command

```bash

npm run test

```

To only run unit tests:
```bash
npm run test:unit
```

To only run integration tests:
```bash
npm run test:integration
```
