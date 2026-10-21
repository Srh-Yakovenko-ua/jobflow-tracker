const BOOLEAN_PARAM_MESSAGE =
  'Boolean positional parameter: use a named field in an options object';

export const RESTRICTED_SYNTAX = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Use an as const object with a union type instead of an enum.',
  },
  {
    selector:
      ":function > Identifier.params[typeAnnotation.typeAnnotation.type='TSBooleanKeyword']",
    message: BOOLEAN_PARAM_MESSAGE,
  },
  {
    selector: ':function > Identifier.params > TSTypeAnnotation > TSUnionType > TSBooleanKeyword',
    message: BOOLEAN_PARAM_MESSAGE,
  },
  {
    selector: ':function > AssignmentPattern.params[right.raw=/^(true|false)$/]',
    message: BOOLEAN_PARAM_MESSAGE,
  },
];

const RAW_COLOUR_PATTERN =
  '/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])|\\b(?:oklch|oklab|rgba?|hsla?)\\(/i';

const RAW_COLOUR_MESSAGE =
  'Raw colour in a component: use a design token (token class, CSS variable or CHART_THEME)';

export const RAW_COLOUR = [
  { selector: `Literal[value=${RAW_COLOUR_PATTERN}]`, message: RAW_COLOUR_MESSAGE },
  { selector: `TemplateElement[value.raw=${RAW_COLOUR_PATTERN}]`, message: RAW_COLOUR_MESSAGE },
];

export const NEST_MAX_PARAMS = {
  selector:
    ":function[params.length>2]:not(MethodDefinition[kind='constructor'] > FunctionExpression, MethodDefinition > FunctionExpression[params.0.decorators.length>0])",
  message: 'More than two positional parameters: pass one options object',
};

export const USER_ID_FIRST = {
  selector:
    "MethodDefinition[kind='method'][accessibility!='private'] > FunctionExpression:not([params.0.name='userId'])",
  message: 'A repository method takes userId as its first parameter',
};
