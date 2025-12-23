## MODIFIED Requirements
### Requirement: Job Creation API
The system SHALL provide a REST API endpoint for creating new video generation jobs with consistent parameter structure.

#### Scenario: Create job with content field
- **WHEN** a client sends POST request to `/jobs` with `content`, `style`, and `language` fields
- **THEN** the system SHALL create a new job with the provided configuration
- **AND** the system SHALL store the configuration in the database using the same field names

#### Scenario: Start video generation workflow
- **WHEN** a client sends POST request to `/jobs/{id}/run`
- **THEN** the system SHALL start the Temporal workflow with the job's config
- **AND** the config SHALL contain `content`, `style`, and `language` fields as defined during job creation

### Requirement: Frontend-Backend Parameter Consistency
The system SHALL ensure consistent parameter naming between frontend and backend APIs.

#### Scenario: Frontend job creation
- **WHEN** user submits the course creation form with markdown content, style, and language
- **THEN** the frontend SHALL send `content` field instead of `markdown`
- **AND** the backend SHALL correctly receive and process the `content` field

#### Scenario: API type definitions
- **WHEN** TypeScript types are generated for API interfaces
- **THEN** they SHALL reflect the correct field names (`content`, `style`, `language`)
- **AND** they SHALL be consistent across frontend and backend codebases
