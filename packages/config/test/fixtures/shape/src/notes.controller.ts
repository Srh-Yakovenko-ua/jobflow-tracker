function CurrentUser(): ParameterDecorator {
  return () => undefined;
}

function Param(name: string): ParameterDecorator {
  return () => name;
}

function Body(): ParameterDecorator {
  return () => undefined;
}

export class NotesController {
  update(@CurrentUser() userId: string, @Param('id') id: string, @Body() body: string): string {
    return `${userId}:${id}:${body}`;
  }
}
