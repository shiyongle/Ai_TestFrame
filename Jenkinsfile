pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    string(name: 'DEPLOY_HOST', defaultValue: 'your-server-ip', description: '部署服务器地址')
    string(name: 'DEPLOY_USER', defaultValue: 'root', description: '部署服务器用户')
    string(name: 'DEPLOY_PATH', defaultValue: '/opt/ai-testframe', description: '服务器部署目录')
    string(name: 'IMAGE_TAG', defaultValue: '', description: '镜像标签，留空则使用 BUILD_NUMBER')
    booleanParam(name: 'SKIP_BUILD', defaultValue: false, description: '跳过本地构建与镜像构建')
  }

  environment {
    APP_NAME = 'ai-testframe'
    REGISTRY = 'your-registry.example.com'
    BACKEND_IMAGE = "${REGISTRY}/ai-testframe/backend"
    FRONTEND_IMAGE = "${REGISTRY}/ai-testframe/frontend"
    EFFECTIVE_TAG = "${params.IMAGE_TAG ?: env.BUILD_NUMBER}"
    COMPOSE_FILE = 'docker-compose.prod.yml'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare Env') {
      steps {
        sh 'cp deploy/docker/.env.prod.example deploy/docker/.env.prod'
      }
    }

    stage('Frontend Build') {
      when {
        expression { !params.SKIP_BUILD }
      }
      steps {
        dir('frontend') {
          sh 'npm ci'
          sh 'npm run build'
        }
      }
    }

    stage('Backend Verify') {
      when {
        expression { !params.SKIP_BUILD }
      }
      steps {
        dir('backend') {
          sh 'python -m pip install --upgrade pip'
          sh 'pip install -r requirements.txt'
          sh 'python -m compileall .'
        }
      }
    }

    stage('Docker Build') {
      when {
        expression { !params.SKIP_BUILD }
      }
      steps {
        sh "docker build -t ${BACKEND_IMAGE}:${EFFECTIVE_TAG} -f backend/Dockerfile ./backend"
        sh "docker build -t ${FRONTEND_IMAGE}:${EFFECTIVE_TAG} -f frontend/Dockerfile ./frontend"
      }
    }

    stage('Docker Push') {
      when {
        expression { !params.SKIP_BUILD }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-registry-credential', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin ${REGISTRY}'
          sh "docker push ${BACKEND_IMAGE}:${EFFECTIVE_TAG}"
          sh "docker push ${FRONTEND_IMAGE}:${EFFECTIVE_TAG}"
        }
      }
    }

    stage('Upload Deploy Assets') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'deploy-ssh-key', keyFileVariable: 'SSH_KEY')]) {
          sh 'scp -i "$SSH_KEY" -o StrictHostKeyChecking=no deploy/docker/docker-compose.prod.yml ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/docker-compose.prod.yml'
          sh 'scp -i "$SSH_KEY" -o StrictHostKeyChecking=no deploy/docker/.env.prod ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.env.prod'
        }
      }
    }

    stage('Deploy') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'deploy-ssh-key', keyFileVariable: 'SSH_KEY')]) {
          sh """
            ssh -i \"$SSH_KEY\" -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} '
              mkdir -p ${DEPLOY_PATH} && \
              cd ${DEPLOY_PATH} && \
              export IMAGE_TAG=${EFFECTIVE_TAG} && \
              docker compose --env-file .env.prod -f ${COMPOSE_FILE} pull && \
              docker compose --env-file .env.prod -f ${COMPOSE_FILE} up -d --remove-orphans
            '
          """
        }
      }
    }

    stage('Health Check') {
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: 'deploy-ssh-key', keyFileVariable: 'SSH_KEY')]) {
          sh """
            ssh -i \"$SSH_KEY\" -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} '
              curl -f http://127.0.0.1:8000/health && \
              docker compose --env-file ${DEPLOY_PATH}/.env.prod -f ${DEPLOY_PATH}/${COMPOSE_FILE} ps
            '
          """
        }
      }
    }
  }

  post {
    success {
      echo "Deploy success: ${EFFECTIVE_TAG}"
    }
    failure {
      echo 'Deploy failed, please inspect Jenkins console log.'
    }
    always {
      cleanWs()
    }
  }
}
