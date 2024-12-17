import { ActionDefinition, EventDefinition, ChannelDefinition, InterfaceExtension } from '../integration'
import { InterfacePackage } from '../package'
import * as utils from '../utils'
import z, { ZuiObjectSchema } from '../zui'

type InterfaceExtensionInput = InterfacePackage & {
  entities: Record<string, { name: string; schema: ZuiObjectSchema }>
  actions: Record<string, { name: string }>
  events: Record<string, { name: string }>
  channels: Record<string, { name: string }>
}

type ResolvedInterface = {
  actions: Record<string, ActionDefinition>
  events: Record<string, EventDefinition>
  channels: Record<string, ChannelDefinition>
}

type InterfaceExtensionOutput = {
  resolved: ResolvedInterface
  statement: InterfaceExtension
}

export const resolveInterface = (intrface: InterfaceExtensionInput): InterfaceExtensionOutput => {
  const { name, version } = intrface

  const resolved: ResolvedInterface = { actions: {}, events: {}, channels: {} }
  const statement: InterfaceExtension = {
    name,
    version,
    entities: utils.records.mapValues(intrface.entities, (entity) => ({ name: entity.name })), // { item: { name: 'issue' } },
    actions: {},
    events: {},
    channels: {},
  }

  const entitySchemas = utils.records.mapValues(intrface.entities, (entity) => entity.schema)

  // dereference actions
  for (const [actionName, action] of Object.entries(intrface.definition.actions ?? {})) {
    const resolvedInputSchema = action.input.schema.dereference(entitySchemas) as z.AnyZodObject
    const resolvedOutputSchema = action.output.schema.dereference(entitySchemas) as z.AnyZodObject

    const newActionName = intrface.actions?.[actionName]?.name ?? actionName
    resolved.actions[newActionName] = {
      ...action,
      input: { schema: resolvedInputSchema },
      output: { schema: resolvedOutputSchema },
    }
    statement.actions[actionName] = { name: newActionName }
  }

  // dereference events
  for (const [eventName, event] of Object.entries(intrface.definition.events ?? {})) {
    const resolvedEventSchema = event.schema.dereference(entitySchemas) as z.AnyZodObject
    const newEventName = intrface.events?.[eventName]?.name ?? eventName
    resolved.events[newEventName] = { ...event, schema: resolvedEventSchema }
    statement.events[eventName] = { name: newEventName }
  }

  // dereference channels
  for (const [channelName, channel] of Object.entries(intrface.definition.channels ?? {})) {
    const messages: Record<string, { schema: z.AnyZodObject }> = {}
    for (const [messageName, message] of Object.entries(channel.messages)) {
      const resolvedMessageSchema = message.schema.dereference(entitySchemas) as z.AnyZodObject
      // no renaming for messages as they are already contained within a channel that acts as a namespace
      messages[messageName] = { ...message, schema: resolvedMessageSchema }
    }
    const newChannelName = intrface.channels?.[channelName]?.name ?? channelName
    resolved.channels[newChannelName] = { ...channel, messages }
    statement.channels[channelName] = { name: newChannelName }
  }

  return { resolved, statement }
}
