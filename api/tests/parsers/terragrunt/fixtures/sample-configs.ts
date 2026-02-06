/**
 * Terragrunt Test Fixtures
 * @module tests/parsers/terragrunt/fixtures/sample-configs
 *
 * Sample Terragrunt configurations for testing all 13 block types
 * and 27 functions.
 */

// ============================================================================
// Root Configuration
// ============================================================================

export const ROOT_CONFIG = `
# Root Terragrunt configuration
# This is typically in the root of the infrastructure repository

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "my-terraform-state-bucket"
    key            = "\${path_relative_to_include()}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      ManagedBy = "Terragrunt"
    }
  }
}
EOF
}
`;

// ============================================================================
// Environment Configuration
// ============================================================================

export const ENV_CONFIG = `
# Environment-specific configuration (e.g., prod/env.hcl)

locals {
  environment = "production"
  aws_region  = "us-east-1"

  common_tags = {
    Environment = local.environment
    ManagedBy   = "Terragrunt"
  }
}

# Retry configuration for this environment
retry_config {
  retryable_errors = [
    "(?s).*Error creating.*",
    "(?s).*TooManyRequestsException.*",
    "(?s).*ThrottlingException.*"
  ]
  max_retry_attempts    = 5
  sleep_between_retries = 30
}
`;

// ============================================================================
// VPC Module Configuration
// ============================================================================

export const VPC_CONFIG = `
# VPC module configuration

include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path           = find_in_parent_folders("env.hcl")
  expose         = true
  merge_strategy = "deep"
}

locals {
  vpc_cidr = "10.0.0.0/16"
  azs      = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-vpc.git//?ref=v5.0.0"
}

inputs = {
  name = "main-vpc"
  cidr = local.vpc_cidr

  azs             = local.azs
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  tags = include.env.locals.common_tags
}
`;

// ============================================================================
// RDS Module Configuration
// ============================================================================

export const RDS_CONFIG = `
# RDS module configuration with VPC dependency

include "root" {
  path = find_in_parent_folders("root.hcl")
}

include "env" {
  path           = find_in_parent_folders("env.hcl")
  expose         = true
  merge_strategy = "deep"
}

dependency "vpc" {
  config_path = "../vpc"

  mock_outputs = {
    vpc_id              = "vpc-mock-12345"
    database_subnet_ids = ["subnet-mock-1", "subnet-mock-2"]
  }

  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

terraform {
  source = "git::https://github.com/terraform-aws-modules/terraform-aws-rds.git//?ref=v6.0.0"
}

inputs = {
  identifier = "main-database"
  engine     = "postgres"
  version    = "15.0"

  instance_class = "db.t3.medium"
  allocated_storage = 100

  vpc_id     = dependency.vpc.outputs.vpc_id
  subnet_ids = dependency.vpc.outputs.database_subnet_ids

  tags = include.env.locals.common_tags
}
`;

// ============================================================================
// ECS Module Configuration
// ============================================================================

export const ECS_CONFIG = `
# ECS module with multiple dependencies

include "root" {
  path = find_in_parent_folders("root.hcl")
}

dependency "vpc" {
  config_path = "../vpc"
}

dependency "rds" {
  config_path = "../rds"
  skip_outputs = true

  mock_outputs = {
    db_instance_endpoint = "mock-db.example.com:5432"
  }
}

dependencies {
  paths = ["../vpc", "../rds"]
}

locals {
  service_name = "api"
  container_port = 8080
}

terraform {
  source = "\${get_terragrunt_dir()}/../../modules/ecs-service"

  extra_arguments "common_vars" {
    commands = get_terraform_commands_that_need_vars()
    arguments = [
      "-var-file=\${get_terragrunt_dir()}/common.tfvars"
    ]
  }

  before_hook "validate" {
    commands = ["apply", "plan"]
    execute  = ["tflint", "--init"]
  }

  after_hook "notify" {
    commands     = ["apply"]
    execute      = ["./scripts/notify.sh"]
    run_on_error = false
  }
}

inputs = {
  name         = local.service_name
  vpc_id       = dependency.vpc.outputs.vpc_id
  db_endpoint  = dependency.rds.outputs.db_instance_endpoint

  container = {
    image = "myapp:latest"
    port  = local.container_port
  }
}
`;

// ============================================================================
// IAM Role Configuration
// ============================================================================

export const IAM_CONFIG = `
# IAM role configuration

iam_role {
  role_arn         = "arn:aws:iam::123456789012:role/terragrunt-admin"
  session_duration = 3600
}

terraform {
  source = "git::https://github.com/example/iam-module.git"
}

inputs = {
  role_name = "application-role"
  account_id = get_aws_account_id()
}
`;

// ============================================================================
// Skip and Prevent Destroy Configuration
// ============================================================================

export const PROTECTION_CONFIG = `
# Configuration with protection settings

prevent_destroy = true
skip = false
download_dir = "/tmp/.terragrunt-cache"

terraform {
  source = "module"
}
`;

// ============================================================================
// All Functions Example
// ============================================================================

export const ALL_FUNCTIONS_CONFIG = `
# Configuration demonstrating all 27 Terragrunt functions

locals {
  # Path functions (6)
  parent_config    = find_in_parent_folders()
  relative_path    = path_relative_to_include()
  relative_from    = path_relative_from_include()
  from_repo_root   = get_path_from_repo_root()
  to_repo_root     = get_path_to_repo_root()
  terragrunt_dir   = get_terragrunt_dir()

  # Include functions (2)
  parent_locals    = read_terragrunt_config(find_in_parent_folders()).locals
  original_dir     = get_original_terragrunt_dir()

  # Dependency functions (2)
  var_commands     = get_terraform_commands_that_need_vars()
  lock_commands    = get_terraform_commands_that_need_locking()

  # Read functions (4)
  secrets          = sops_decrypt_file("secrets.enc.json")
  git_branch       = run_cmd("git", "branch", "--show-current")
  tf_vars          = read_tfvars_file("terraform.tfvars")
  shell_result     = local_exec("echo hello")

  # AWS functions (8)
  account_id       = get_aws_account_id()
  caller_arn       = get_aws_caller_identity_arn()
  caller_user_id   = get_aws_caller_identity_user_id()
  current_region   = get_aws_region()
  account_alias    = get_aws_account_alias()
  retryable_errors = get_default_retryable_errors()
  tf_command       = get_terraform_command()
  tf_cli_args      = get_terraform_cli_args()

  # Runtime functions (2)
  env_var          = get_env("AWS_REGION", "us-east-1")
  platform         = get_platform()

  # Utility functions (3)
  safe_secret      = mark_as_read(local.secrets)
  aws_provider     = render_aws_provider_settings()
  parsed_arn       = parse_aws_arn("arn:aws:s3:::my-bucket")
}

terraform {
  source = "module"
}
`;

// ============================================================================
// Malformed Configurations for Error Testing
// ============================================================================

export const MALFORMED_BLOCK = `
terraform {
  source =
}
`;

export const UNKNOWN_BLOCK = `
unknown_block_type {
  value = "test"
}
`;

export const UNCLOSED_BRACE = `
terraform {
  source = "module"
`;

export const INVALID_FUNCTION = `
locals {
  value = unknown_function()
}
`;

export const CIRCULAR_INCLUDE = `
# This would create a circular include if A includes B and B includes A
include "other" {
  path = "../other/terragrunt.hcl"
}
`;

// ============================================================================
// Block Type Examples (All 13)
// ============================================================================

export const ALL_BLOCK_TYPES = {
  terraform: `
terraform {
  source = "git::https://github.com/example/module.git"
}
`,

  remote_state: `
remote_state {
  backend = "s3"
  config = {
    bucket = "state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}
`,

  include: `
include "root" {
  path   = find_in_parent_folders()
  expose = true
}
`,

  locals: `
locals {
  region = "us-east-1"
  env    = "prod"
}
`,

  dependency: `
dependency "vpc" {
  config_path = "../vpc"
}
`,

  dependencies: `
dependencies {
  paths = ["../vpc", "../rds"]
}
`,

  generate: `
generate "provider" {
  path     = "provider.tf"
  contents = "provider \\"aws\\" {}"
}
`,

  inputs: `
inputs = {
  region = "us-east-1"
  count  = 3
}
`,

  download_dir: `
download_dir = "/tmp/.terragrunt"
`,

  prevent_destroy: `
prevent_destroy = true
`,

  skip: `
skip = false
`,

  iam_role: `
iam_role {
  role_arn = "arn:aws:iam::123456789:role/terraform"
}
`,

  retry_config: `
retry_config {
  retryable_errors      = [".*Error.*"]
  max_retry_attempts    = 3
  sleep_between_retries = 5
}
`,
};

// ============================================================================
// Function Examples (All 27)
// ============================================================================

export const FUNCTION_EXAMPLES = {
  // Path functions (6)
  find_in_parent_folders: 'find_in_parent_folders()',
  find_in_parent_folders_with_arg: 'find_in_parent_folders("common.hcl")',
  path_relative_to_include: 'path_relative_to_include()',
  path_relative_from_include: 'path_relative_from_include()',
  get_path_from_repo_root: 'get_path_from_repo_root()',
  get_path_to_repo_root: 'get_path_to_repo_root()',
  get_terragrunt_dir: 'get_terragrunt_dir()',

  // Include functions (2)
  read_terragrunt_config: 'read_terragrunt_config(find_in_parent_folders())',
  get_original_terragrunt_dir: 'get_original_terragrunt_dir()',

  // Dependency functions (2)
  get_terraform_commands_that_need_vars: 'get_terraform_commands_that_need_vars()',
  get_terraform_commands_that_need_locking: 'get_terraform_commands_that_need_locking()',

  // Read functions (4)
  sops_decrypt_file: 'sops_decrypt_file("secrets.enc.json")',
  local_exec: 'local_exec("echo hello")',
  read_tfvars_file: 'read_tfvars_file("terraform.tfvars")',
  run_cmd: 'run_cmd("echo", "hello", "world")',

  // AWS functions (8)
  get_aws_account_id: 'get_aws_account_id()',
  get_aws_caller_identity_arn: 'get_aws_caller_identity_arn()',
  get_aws_caller_identity_user_id: 'get_aws_caller_identity_user_id()',
  get_aws_region: 'get_aws_region()',
  get_aws_account_alias: 'get_aws_account_alias()',
  get_default_retryable_errors: 'get_default_retryable_errors()',
  get_terraform_command: 'get_terraform_command()',
  get_terraform_cli_args: 'get_terraform_cli_args()',

  // Runtime functions (2)
  get_env: 'get_env("AWS_REGION", "us-east-1")',
  get_platform: 'get_platform()',

  // Utility functions (3)
  mark_as_read: 'mark_as_read(local.secret)',
  render_aws_provider_settings: 'render_aws_provider_settings()',
  parse_aws_arn: 'parse_aws_arn("arn:aws:s3:::my-bucket")',
};
