# Contributing to WitnessChain

Thank you for your interest in contributing to WitnessChain! This document provides guidelines for contributing to our decentralized human rights evidence platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Read the Documentation**
   - Start with our [README](README.md)
   - Review the [Full Proposal](docs/PROPOSAL.md)
   - Check the [Architecture](docs/ARCHITECTURE.md) for technical details

2. **Join the Community**
   - Participate in [GitHub Discussions](https://github.com/Hany-Almnaem/witnesschain/discussions)
   - Review existing issues and discussions
   - Introduce yourself in the "Welcome to WitnessChain" discussion

## How to Contribute

### Types of Contributions

- **Code Contributions**: Bug fixes, new features, improvements
- **Documentation**: Improving docs, tutorials, examples
- **Testing**: Writing tests, improving test coverage
- **Security**: Security reviews, vulnerability reports
- **Community**: Helping others, moderating discussions
- **Research**: Technical research, architecture improvements

### Finding Work

Look for issues labeled:
- `good-first-issue` - Great for newcomers
- `help-wanted` - Community contributions welcome
- `mvp` - Core MVP features
- `security` - Security-related work
- `documentation` - Documentation improvements
- `grant` - Grant application related

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Git
- Basic understanding of Web3 technologies (Filecoin, IPFS, FVM)

### Setup Steps

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/witnesschain.git
   cd witnesschain
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Environment**
   ```bash
   # Backend
   cd packages/backend
   npm run dev

   # Frontend (in another terminal)
   cd packages/frontend
   npm run dev
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

### Project Structure

```
witnesschain/
├── docs/                 # Documentation
├── packages/
│   ├── backend/         # Express.js API server
│   └── frontend/        # React frontend
├── .github/             # GitHub templates and workflows
└── README.md
```

## Pull Request Process

### Before Submitting

1. **Check Existing Issues**: Ensure your work addresses an existing issue or create a new one
2. **Follow Coding Standards**: Use consistent formatting and style
3. **Write Tests**: Include tests for new functionality
4. **Update Documentation**: Update relevant documentation
5. **Test Thoroughly**: Ensure your changes work as expected

### PR Guidelines

1. **Use Descriptive Titles**: Clear, concise PR titles
2. **Link Issues**: Reference related issues using `Fixes #123` or `Closes #123`
3. **Provide Context**: Explain what your PR does and why
4. **Keep PRs Focused**: One feature or fix per PR
5. **Request Reviews**: Tag relevant reviewers

### PR Template

When creating a PR, please include:

- **Description**: What does this PR do?
- **Type of Change**: Bug fix, new feature, documentation, etc.
- **Testing**: How was this tested?
- **Checklist**: Confirm you've completed required steps

## Issue Guidelines

### Bug Reports

When reporting bugs, please include:

- **Clear Description**: What happened vs. what you expected
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Environment**: OS, Node.js version, browser, etc.
- **Screenshots**: If applicable
- **Logs**: Relevant error messages or logs

### Feature Requests

For new features, please include:

- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions you've considered
- **Additional Context**: Any other relevant information

### Security Issues

**Do not** report security vulnerabilities through public issues. Instead: (comming soon)

1. Email security concerns to: [security@witnesschain.org](mailto:security@witnesschain.org)
2. See our [Security Policy](docs/SECURITY.md) for more details

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/ipfs-integration`
- `fix/upload-endpoint`
- `docs/api-documentation`
- `security/encryption-review`

### Commit Messages

Follow conventional commit format:
- `feat: add IPFS upload functionality`
- `fix: resolve timestamp validation issue`
- `docs: update API documentation`
- `test: add unit tests for verification`

### Code Review Process

1. **Self Review**: Review your own code before requesting review
2. **Address Feedback**: Respond to reviewer comments
3. **Update PR**: Make requested changes
4. **Merge**: Once approved, merge the PR

## Areas Needing Help

### High Priority

- **FVM Smart Contracts**: Timestamp and verification contracts
- **IPFS Integration**: File upload and retrieval
- **Security Review**: Encryption and privacy features
- **Testing**: Unit and integration tests
- **Documentation**: API docs and tutorials

### Community Needs

- **Translation**: Multi-language support
- **UX/UI**: User interface improvements
- **Performance**: Optimization and monitoring
- **Deployment**: CI/CD and infrastructure

## Getting Help

- **GitHub Discussions**: For questions and community support
- **Issues**: For bug reports and feature requests
- **Security**: For security-related concerns
- **Email**: For private matters

## Recognition

Contributors will be recognized in:
- **CONTRIBUTORS.md**: List of all contributors
- **Release Notes**: Credit for significant contributions
- **Community**: Public recognition for valuable contributions

Thank you for contributing to WitnessChain and helping preserve human rights evidence on the decentralized web!

---

*Questions? Feel free to open a discussion or reach out to the maintainers.*
