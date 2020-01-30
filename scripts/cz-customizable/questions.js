const _ = require('lodash');
const buildCommit = require('./buildCommit');
const log = require('./logger');

const isNotWip = answers => answers.type.toLowerCase() !== 'wip';

const isValidateTicketNo = (value, config) => {
  if (!value) {
    return !config.isTicketNumberRequired;
  }
  if (!config.ticketNumberRegExp) {
    return true;
  }
  const reg = new RegExp(config.ticketNumberRegExp);
  return value.replace(reg, '') === '';
};

module.exports = {
  getQuestions(config, cz) {
    // normalize config optional options
    const scopeOverrides = config.scopeOverrides || {};
    const messages = config.messages || {};
    const skipQuestions = config.skipQuestions || [];

    messages.type =
      messages.type || 'Select the type of change that youre committing:';
    messages.scope =
      messages.scope || '\nDenote the SCOPE of this change (optional):';
    messages.customScope =
      messages.customScope || 'Denote the SCOPE of this change:';
    if (!messages.ticketNumber) {
      if (config.ticketNumberRegExp) {
        messages.ticketNumber =
          messages.ticketNumberPattern ||
          `Enter the ticket number following this pattern (${config.ticketNumberRegExp})\n`;
      } else {
        messages.ticketNumber = 'Enter the ticket number:\n';
      }
    }
    messages.subject =
      messages.subject ||
      'Write a SHORT, IMPERATIVE tense description of the change:\n';
    messages.body =
      messages.body ||
      'Provide a LONGER description of the change (optional). Use "|" to break new line:\n';
    messages.breaking =
      messages.breaking || 'List any BREAKING CHANGES (optional):\n';
    messages.footer =
      messages.footer ||
      'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34:\n';
    messages.confirmCommit =
      messages.confirmCommit ||
      'Are you sure you want to proceed with the commit above?';

    // 为 types 添加序号和提交类型
    const valueL = config.types.reduce(function(x, y) {
      return Math.max(x, y.value.length);
    }, 0);
    const types = config.types.map((x, i) => {
      x.name = `${(i + 1)
        .toString()
        .padStart(config.types.length / 10 + 1, ' ')}. ${x.value.padEnd(
        valueL + 2,
        ' '
      )}${x.name}`;
      return x;
    });

    let questions = [
      {
        type: 'list',
        name: 'type',
        message: messages.type,
        choices: types
      },
      {
        type: 'list',
        name: 'scope',
        message: messages.scope,
        choices(answers) {
          let scopes = [];
          if (scopeOverrides[answers.type]) {
            scopes = scopes.concat(scopeOverrides[answers.type]);
          } else {
            scopes = scopes.concat(config.scopes);
          }
          if (config.allowCustomScopes || scopes.length === 0) {
            scopes = scopes.concat([
              new cz.Separator(),
              { name: 'empty', value: false },
              { name: 'custom', value: 'custom' }
            ]);
          }
          return scopes;
        },
        when(answers) {
          let hasScope = false;
          if (scopeOverrides[answers.type]) {
            hasScope = !!(scopeOverrides[answers.type].length > 0);
          } else {
            hasScope = !!(config.scopes && config.scopes.length > 0);
          }
          if (!hasScope) {
            // TODO: Fix when possible
            // eslint-disable-next-line no-param-reassign
            answers.scope = 'custom';
            return false;
          }
          return isNotWip(answers);
        }
      },
      {
        type: 'input',
        name: 'scope',
        message: messages.customScope,
        when(answers) {
          return answers.scope === 'custom';
        }
      },
      {
        type: 'input',
        name: 'ticketNumber',
        message: messages.ticketNumber,
        when() {
          return !!config.allowTicketNumber; // no ticket numbers allowed unless specifed
        },
        validate(value) {
          return isValidateTicketNo(value, config);
        }
      },
      {
        type: 'input',
        name: 'subject',
        message: messages.subject,
        validate(value) {
          const limit = config.subjectLimit || 100;
          if (value.length > limit) {
            return `Exceed limit: ${limit}`;
          }
          return true;
        },
        filter(value) {
          const upperCaseSubject = config.upperCaseSubject || false;

          return (
            (upperCaseSubject
              ? value.charAt(0).toUpperCase()
              : value.charAt(0).toLowerCase()) + value.slice(1)
          );
        }
      },
      {
        type: 'input',
        name: 'body',
        message: messages.body
      },
      {
        type: 'input',
        name: 'breaking',
        message: messages.breaking,
        when(answers) {
          // eslint-disable-next-line max-len
          if (
            config.askForBreakingChangeFirst ||
            (config.allowBreakingChanges &&
              config.allowBreakingChanges.indexOf(answers.type.toLowerCase()) >=
                0)
          ) {
            return true;
          }
          return false; // no breaking changes allowed unless specifed
        }
      },
      {
        type: 'input',
        name: 'footer',
        message: messages.footer,
        when: isNotWip
      },
      {
        type: 'expand',
        name: 'confirmCommit',
        choices: [
          { key: 'y', name: 'Yes', value: 'yes' },
          { key: 'n', name: 'Abort commit', value: 'no' },
          { key: 'e', name: 'Edit message', value: 'edit' }
        ],
        default: 0,
        message(answers) {
          const SEP =
            '###--------------------------------------------------------###';
          log.info(`\n${SEP}\n${buildCommit(answers, config)}\n${SEP}\n`);
          return messages.confirmCommit;
        }
      }
    ];

    questions = questions.filter(item => !skipQuestions.includes(item.name));

    if (config.askForBreakingChangeFirst) {
      const isBreaking = oneQuestion => oneQuestion.name === 'breaking';

      const breakingQuestion = _.filter(questions, isBreaking);
      const questionWithoutBreaking = _.reject(questions, isBreaking);

      questions = _.concat(breakingQuestion, questionWithoutBreaking);
    }

    return questions;
  }
};