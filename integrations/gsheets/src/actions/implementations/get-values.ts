import { wrapAction } from '../action-wrapper'

export const getValues = wrapAction(
  { actionName: 'getValues', errorMessageWhenFailed: 'Failed to get values from the specified range' },
  async ({ input, gsheetsClient }) => {
    const response = await gsheetsClient.getValues(input.range, input.majorDimension)

    return {
      ...response,
      majorDimension: (response.majorDimension === 'COLUMNS' ? 'COLUMNS' : 'ROWS') as 'COLUMNS' | 'ROWS',
    }
  }
)
