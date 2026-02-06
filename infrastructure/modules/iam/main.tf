#------------------------------------------------------------------------------
# IAM Module - ECS Task Roles and Policies
# Creates execution role (for ECS agent) and task role (for application)
#------------------------------------------------------------------------------

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

#------------------------------------------------------------------------------
# Data Sources
#------------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

#------------------------------------------------------------------------------
# ECS Task Execution Role
# Used by the ECS agent to pull images, fetch secrets, and write logs
#------------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    sid     = "ECSTasksAssumeRole"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name_prefix}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  description        = "ECS task execution role for ${local.name_prefix}"

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-ecs-task-execution"
  })
}

# Attach AWS managed policy for basic ECS task execution
resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom policy for secrets access and additional logging permissions
data "aws_iam_policy_document" "task_execution_custom" {
  # Secrets Manager access for retrieving application secrets
  dynamic "statement" {
    for_each = length(var.secret_arns) > 0 ? [1] : []
    content {
      sid    = "SecretsManagerAccess"
      effect = "Allow"
      actions = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      resources = var.secret_arns
    }
  }

  # KMS decrypt for encrypted secrets (if KMS keys provided)
  dynamic "statement" {
    for_each = length(var.kms_key_arns) > 0 ? [1] : []
    content {
      sid    = "KMSDecrypt"
      effect = "Allow"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey"
      ]
      resources = var.kms_key_arns
    }
  }

  # CloudWatch Logs access for container logging
  statement {
    sid    = "CloudWatchLogsAccess"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ]
    resources = [
      var.log_group_arn,
      "${var.log_group_arn}:*"
    ]
  }
}

resource "aws_iam_role_policy" "task_execution_custom" {
  name   = "${local.name_prefix}-ecs-task-execution-custom"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_custom.json
}

#------------------------------------------------------------------------------
# ECS Task Role
# Used by the application running inside the container
#------------------------------------------------------------------------------

resource "aws_iam_role" "task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
  description        = "ECS task role for ${local.name_prefix} application"

  tags = merge(var.tags, {
    Name = "${local.name_prefix}-ecs-task"
  })
}

# S3 access policy for application
data "aws_iam_policy_document" "task_s3" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0

  # Bucket-level permissions (ListBucket)
  statement {
    sid    = "S3BucketAccess"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation"
    ]
    resources = var.s3_bucket_arns
  }

  # Object-level permissions
  statement {
    sid    = "S3ObjectAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObjectVersion",
      "s3:GetObjectTagging",
      "s3:PutObjectTagging"
    ]
    resources = [for arn in var.s3_bucket_arns : "${arn}/*"]
  }
}

resource "aws_iam_role_policy" "task_s3" {
  count = length(var.s3_bucket_arns) > 0 ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-s3"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_s3[0].json
}

# ECS Exec policy for debugging (optional)
data "aws_iam_policy_document" "task_ecs_exec" {
  count = var.enable_ecs_exec ? 1 : 0

  statement {
    sid    = "ECSExecSSMMessages"
    effect = "Allow"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel"
    ]
    resources = ["*"]
  }

  # Optional: Restrict ECS Exec logging to specific log group
  statement {
    sid    = "ECSExecLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents"
    ]
    resources = [
      var.log_group_arn,
      "${var.log_group_arn}:*"
    ]
  }
}

resource "aws_iam_role_policy" "task_ecs_exec" {
  count = var.enable_ecs_exec ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-exec"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_ecs_exec[0].json
}

# X-Ray tracing policy (optional)
data "aws_iam_policy_document" "task_xray" {
  count = var.enable_xray ? 1 : 0

  statement {
    sid    = "XRayTracing"
    effect = "Allow"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets",
      "xray:GetSamplingStatisticSummaries"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task_xray" {
  count = var.enable_xray ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-xray"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_xray[0].json
}

# Base CloudWatch metrics policy for application
data "aws_iam_policy_document" "task_cloudwatch" {
  statement {
    sid    = "CloudWatchMetrics"
    effect = "Allow"
    actions = [
      "cloudwatch:PutMetricData"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["${var.project_name}/${var.environment}"]
    }
  }
}

resource "aws_iam_role_policy" "task_cloudwatch" {
  name   = "${local.name_prefix}-ecs-task-cloudwatch"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_cloudwatch.json
}

#------------------------------------------------------------------------------
# Additional Custom Policies (optional)
#------------------------------------------------------------------------------

resource "aws_iam_role_policy" "task_custom" {
  count = var.task_custom_policy_json != null ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-custom"
  role   = aws_iam_role.task.id
  policy = var.task_custom_policy_json
}

resource "aws_iam_role_policy" "task_execution_custom_additional" {
  count = var.task_execution_custom_policy_json != null ? 1 : 0

  name   = "${local.name_prefix}-ecs-task-execution-custom-additional"
  role   = aws_iam_role.task_execution.id
  policy = var.task_execution_custom_policy_json
}
