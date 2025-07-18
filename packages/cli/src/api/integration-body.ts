import * as client from '@botpress/client'
import * as sdk from '@botpress/sdk'
import * as utils from '../utils'
import * as types from './types'

export const prepareCreateIntegrationBody = async (
  integration: sdk.IntegrationDefinition | sdk.IntegrationPackage['definition']
): Promise<types.CreateIntegrationRequestBody> => ({
  name: integration.name,
  version: integration.version,
  title: 'title' in integration ? integration.title : undefined,
  description: 'description' in integration ? integration.description : undefined,
  user: integration.user,
  events: integration.events
    ? await utils.records.mapValuesAsync(integration.events, async (event) => ({
        ...event,
        schema: await utils.schema.mapZodToJsonSchema(event),
      }))
    : undefined,
  actions: integration.actions
    ? await utils.records.mapValuesAsync(integration.actions, async (action) => ({
        ...action,
        input: {
          ...action.input,
          schema: await utils.schema.mapZodToJsonSchema(action.input),
        },
        output: {
          ...action.output,
          schema: await utils.schema.mapZodToJsonSchema(action.output),
        },
      }))
    : undefined,
  channels: integration.channels
    ? await utils.records.mapValuesAsync(integration.channels, async (channel) => ({
        ...channel,
        messages: await utils.records.mapValuesAsync(channel.messages, async (message) => ({
          ...message,
          schema: await utils.schema.mapZodToJsonSchema(message),
        })),
      }))
    : undefined,
  states: integration.states
    ? await utils.records.mapValuesAsync(integration.states, async (state) => ({
        ...state,
        schema: await utils.schema.mapZodToJsonSchema(state),
      }))
    : undefined,
  entities: integration.entities
    ? await utils.records.mapValuesAsync(integration.entities, async (entity) => ({
        ...entity,
        schema: await utils.schema.mapZodToJsonSchema(entity),
      }))
    : undefined,
  attributes: integration.attributes,
  extraOperations: '__advanced' in integration ? integration.__advanced?.extraOperations : undefined,
})

type UpdateIntegrationChannelsBody = NonNullable<types.UpdateIntegrationRequestBody['channels']>
type UpdateIntegrationChannelBody = UpdateIntegrationChannelsBody[string]
type Channels = client.Integration['channels']
type Channel = client.Integration['channels'][string]
export const prepareUpdateIntegrationBody = (
  localIntegration: types.UpdateIntegrationRequestBody,
  remoteIntegration: client.Integration
): types.UpdateIntegrationRequestBody => {
  const actions = utils.attributes.prepareAttributeUpdateBody({
    localItems: utils.records.setNullOnMissingValues(localIntegration.actions, remoteIntegration.actions),
    remoteItems: remoteIntegration.actions,
  })
  const events = utils.attributes.prepareAttributeUpdateBody({
    localItems: utils.records.setNullOnMissingValues(localIntegration.events, remoteIntegration.events),
    remoteItems: remoteIntegration.events,
  })
  const states = utils.records.setNullOnMissingValues(localIntegration.states, remoteIntegration.states)
  const entities = utils.records.setNullOnMissingValues(localIntegration.entities, remoteIntegration.entities)
  const user = {
    ...localIntegration.user,
    tags: utils.records.setNullOnMissingValues(localIntegration.user?.tags, remoteIntegration.user?.tags),
  }

  const channels = _prepareUpdateIntegrationChannelsBody(localIntegration.channels ?? {}, remoteIntegration.channels)

  const interfaces = utils.records.setNullOnMissingValues(localIntegration.interfaces, remoteIntegration.interfaces)

  const configurations = utils.records.setNullOnMissingValues(
    localIntegration.configurations,
    remoteIntegration.configurations
  )

  const readme = localIntegration.readme
  const icon = localIntegration.icon

  const attributes = utils.records.setNullOnMissingValues(localIntegration.attributes, remoteIntegration.attributes)

  const extraOperations = localIntegration.extraOperations
  return {
    ..._maybeRemoveVrlScripts(localIntegration, remoteIntegration),
    actions,
    events,
    states,
    entities,
    user,
    channels,
    interfaces,
    configurations,
    readme,
    icon,
    attributes,
    extraOperations,
  }
}

const _maybeRemoveVrlScripts = (
  localIntegration: types.UpdateIntegrationRequestBody,
  remoteIntegration: client.Integration
): types.UpdateIntegrationRequestBody => {
  const newIntegration = structuredClone(localIntegration)

  if (
    remoteIntegration.configuration?.identifier?.linkTemplateScript &&
    !localIntegration.configuration?.identifier?.linkTemplateScript
  ) {
    newIntegration.configuration ??= remoteIntegration.configuration
    newIntegration.configuration.identifier ??= remoteIntegration.configuration.identifier
    newIntegration.configuration.identifier.linkTemplateScript = null
    newIntegration.configuration.identifier.required = false
  }

  if (remoteIntegration.identifier.extractScript && !localIntegration.identifier?.extractScript) {
    newIntegration.identifier ??= remoteIntegration.identifier
    newIntegration.identifier.extractScript = null
  }

  if (remoteIntegration.identifier.fallbackHandlerScript && !localIntegration.identifier?.fallbackHandlerScript) {
    newIntegration.identifier ??= remoteIntegration.identifier
    newIntegration.identifier.fallbackHandlerScript = null
  }

  for (const configName of Object.keys(localIntegration.configurations ?? {})) {
    if (
      remoteIntegration.configurations[configName]?.identifier.linkTemplateScript &&
      !localIntegration.configurations?.[configName]?.identifier?.linkTemplateScript
    ) {
      newIntegration.configurations ??= remoteIntegration.configurations
      newIntegration.configurations[configName] ??= remoteIntegration.configurations[configName]
      newIntegration.configurations[configName].identifier ??= remoteIntegration.configurations[configName].identifier
      newIntegration.configurations[configName].identifier.linkTemplateScript = null
      newIntegration.configurations[configName].identifier.required = false
    }
  }

  return newIntegration
}

const _prepareUpdateIntegrationChannelsBody = (
  localChannels: UpdateIntegrationChannelsBody,
  remoteChannels: Channels
): UpdateIntegrationChannelsBody => {
  const channelBody: UpdateIntegrationChannelsBody = {}

  const zipped = utils.records.zipObjects(localChannels, remoteChannels)
  for (const [channelName, [localChannel, remoteChannel]] of Object.entries(zipped)) {
    if (localChannel && remoteChannel) {
      // channel has to be updated
      channelBody[channelName] = _prepareUpdateIntegrationChannelBody(localChannel, remoteChannel)
    } else if (localChannel) {
      // channel has to be created
      channelBody[channelName] = localChannel
      continue
    } else if (remoteChannel) {
      // channel has to be deleted
      channelBody[channelName] = null
      continue
    }
  }

  return channelBody
}

const _prepareUpdateIntegrationChannelBody = (
  localChannel: UpdateIntegrationChannelBody,
  remoteChannel: Channel
): UpdateIntegrationChannelBody => ({
  ...localChannel,
  messages: utils.records.setNullOnMissingValues(localChannel?.messages, remoteChannel.messages),
  message: {
    ...localChannel?.message,
    tags: utils.records.setNullOnMissingValues(localChannel?.message?.tags, remoteChannel.message.tags),
  },
  conversation: {
    ...localChannel?.conversation,
    tags: utils.records.setNullOnMissingValues(localChannel?.conversation?.tags, remoteChannel.conversation.tags),
  },
})
