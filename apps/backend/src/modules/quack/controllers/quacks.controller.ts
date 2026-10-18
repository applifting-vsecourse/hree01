import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { ListQuacksQueryDto } from './dto/list-quacks.query.dto';
import { PollResponseDto } from './dto/poll.response.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { VoteDto } from './dto/vote.dto';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @ApiOperation({ summary: 'List all quacks, optionally filtered by a search' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 400, description: 'Search query too long' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    @Query() query: ListQuacksQueryDto,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.searchQuacks(user, query.q ?? '');
    return quacks.map(QuackResponseDto.fromDomain);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      mood: body.mood ?? null,
      poll: body.poll
        ? {
            options: body.poll.options,
            resultsVisibility: body.poll.resultsVisibility ?? 'right_away',
          }
        : null,
    });
    return QuackResponseDto.fromDomain(quack);
  }

  @Put(':quackId/vote')
  @ApiOperation({
    summary: 'Vote in a poll, or move your vote to another option',
  })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 400, description: 'Option is not part of this poll' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  @ApiResponse({ status: 409, description: 'Poll is closed' })
  async vote(
    @User() user: Identity,
    @Param('quackId') quackId: string,
    @Body() body: VoteDto,
  ): Promise<PollResponseDto> {
    const poll = await this.quacksService.setVote(user, quackId, body.optionId);
    return PollResponseDto.fromDomain(poll);
  }

  @Delete(':quackId/vote')
  @ApiOperation({ summary: 'Remove your vote from a poll' })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  @ApiResponse({ status: 409, description: 'Poll is closed' })
  async removeVote(
    @User() user: Identity,
    @Param('quackId') quackId: string,
  ): Promise<PollResponseDto> {
    const poll = await this.quacksService.setVote(user, quackId, null);
    return PollResponseDto.fromDomain(poll);
  }

  @Post(':quackId/poll/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a poll for good (author only)' })
  @ApiResponse({ status: 200, type: PollResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  @ApiResponse({ status: 403, description: 'Not the author of the poll' })
  @ApiResponse({ status: 404, description: 'Poll not found' })
  async closePoll(
    @User() user: Identity,
    @Param('quackId') quackId: string,
  ): Promise<PollResponseDto> {
    const poll = await this.quacksService.closePoll(user, quackId);
    return PollResponseDto.fromDomain(poll);
  }
}
