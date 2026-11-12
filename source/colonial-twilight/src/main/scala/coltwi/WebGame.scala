package coltwi

import scala.scalajs.js
import scala.scalajs.js.JSConverters._
import scala.scalajs.js.annotation.JSExportTopLevel

import ColonialTwilight._

object WebGame {
  private case class Start(scenario: Scenario, finalSupport: Boolean, seed: Int)
  private case class Boundary(
    state: GameState,
    files: FUtil.Snapshot,
    randomState: Long,
    botState: Bot.TurnState,
    specialActivity: (Boolean, Boolean),
    movingGroups: Map[String, Pieces]
  )
  private case class Saved(boundary: Boundary, inputIndex: Int, lineIndex: Int)

  private var start = Option.empty[Start]
  private var boundary = Option.empty[Boundary]
  private var turnInputs = Vector.empty[String]
  private var shownLines = 0
  private var ended = false

  @JSExportTopLevel("openGame")
  def openGame(scenarioKey: String, finalSupport: Boolean, seed: Int, inputs: js.Array[String]): js.Object = {
    start = Some(Start(scenarios(scenarioKey), finalSupport, seed))
    boundary = None
    turnInputs = Vector.empty
    shownLines = 0
    ended = false
    replay(inputs.toVector, restoring = inputs.nonEmpty)
  }

  @JSExportTopLevel("answerPrompt")
  def answerPrompt(input: String): js.Object = {
    require(!ended, "This game has closed")
    replay(turnInputs :+ input, restoring = false)
  }

  @JSExportTopLevel("listCards")
  def listCards(): js.Array[js.Object] =
    deck.cards.filterNot(card => deck.isPivotalCard(card.number)).map[js.Object] { card =>
      js.Dynamic.literal(number = card.number, name = card.name)
    }.toJSArray

  private def replay(inputs: Vector[String], restoring: Boolean): js.Object = {
    val settings = start.getOrElse(throw new IllegalStateException("Open a game first"))
    WebIO.begin(inputs)
    echoLogging = true
    gameName = Some("Table Game")
    var saved = Option.empty[Saved]
    WebIO.onTurnSaved = () => {
      val current = Boundary(game, FUtil.storage, WebRandom.snapshot, Bot.turnState,
        Human.specialActivity.snapshot, Human.movingGroups.groups)
      saved = Some(Saved(current, WebIO.consumed, WebIO.lines.length))
    }

    try {
      boundary match {
        case Some(from) =>
          game = from.state
          FUtil.storage = from.files
          WebRandom.restore(from.randomState)
          Bot.turnState = from.botState
          Human.specialActivity.restore(from.specialActivity)
          Human.movingGroups.groups = from.movingGroups
          mainLoop(saveCurrent = false)
        case None =>
          FUtil.storage = FUtil.empty
          WebRandom.seed(settings.seed.toLong)
          Bot.turnState = Bot.TurnState()
          Human.specialActivity.init(allow = false)
          Human.movingGroups.reset()
          game = initialGameState(settings.scenario, settings.finalSupport)
          logSummary(game.scenarioSummary)
          log()
          settings.scenario.additionalSetup()
          mainLoop()
      }
    } catch {
      case WebIO.Waiting => ()
      case ExitGame => ended = true
    } finally {
      WebIO.onTurnSaved = () => ()
    }
    if (restoring && WebIO.consumed != inputs.length) {
      throw new IllegalArgumentException("Saved responses continue past the end of the game")
    }

    val fromLine = if (restoring) saved.fold(0)(_.lineIndex) else shownLines
    val output = WebIO.lines.iterator.drop(fromLine).map { line =>
      js.Dynamic.literal(text = line.text, style = line.style)
    }.toJSArray
    val priorHistory = if (restoring) saved.toVector.flatMap(_.boundary.state.history.takeRight(160)) else Vector.empty
    boundary = saved.map(_.boundary).orElse(boundary)
    turnInputs = inputs.drop(saved.fold(0)(_.inputIndex))
    shownLines = WebIO.lines.length - saved.fold(0)(_.lineIndex)

    val prompt = WebIO.prompt.map { next =>
      val view = js.Dynamic.literal(
        text = next.text,
        kind = next.kind,
        allowEmpty = next.allowEmpty,
        options = next.options.map { case (value, label) =>
          js.Dynamic.literal(value = value, label = label)
        }.toJSArray
      )
      next.bounds.foreach { case (minimum, maximum) =>
        view.minimum = minimum
        view.maximum = maximum
      }
      view
    }
    js.Dynamic.literal(
      prompt = prompt.orNull,
      state = gameView(),
      output = output,
      priorHistory = priorHistory.map(_.text).toJSArray,
      ended = ended
    )
  }

  private def gameView(): js.Object = {
    val activeCard = game.currentCard.map(deck(_).numAndName)
    val winner = game.history.reverseIterator.map(_.text.trim)
      .find(_.startsWith("Game over: ")).map(_.stripPrefix("Game over: "))
    val spaces = game.spaces.sortBy(_.name).map { space =>
      js.Dynamic.literal(
        name = space.nameAndZone,
        control = space.control.toString,
        support = space.support.toString,
        population = space.population,
        pieces = space.stringItems.toJSArray,
        markers = space.markers.sorted.toJSArray
      )
    }

    js.Dynamic.literal(
      scenario = game.params.scenarioName,
      turn = game.turn,
      currentCard = activeCard.orNull[String],
      previousCard = game.previousCard.map(deck(_).numAndName).orNull[String],
      firstEligible = game.sequence.firstEligible.name,
      secondEligible = game.sequence.secondEligible.name,
      govResources = game.resources(Gov),
      flnResources = game.resources(Fln),
      govPoints = game.govPoints,
      flnPoints = game.flnPoints,
      commitment = game.commitment,
      franceTrack = game.franceTrackLetter.toString,
      borderZone = game.borderZoneTrack,
      propCardsPlayed = game.propCardsPlayed,
      numberOfPropCards = game.numberOfPropCards,
      winner = winner.orNull[String],
      spaces = spaces.toJSArray
    )
  }
}
