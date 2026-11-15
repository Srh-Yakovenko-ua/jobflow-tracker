import { InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';

const NEST_VERSIONS = ['>=4.0.0 <13'];

export class Nest12Instrumentation extends NestInstrumentation {
  override init(): InstrumentationNodeModuleDefinition {
    const nestCore = new InstrumentationNodeModuleDefinition(
      NestInstrumentation.COMPONENT,
      NEST_VERSIONS,
    );
    nestCore.files.push(
      this.getNestFactoryFileInstrumentation(NEST_VERSIONS),
      this.getRouterExecutionContextFileInstrumentation(NEST_VERSIONS),
    );
    return nestCore;
  }
}
